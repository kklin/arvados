import functools
import json
import logging
import mock
import os
import unittest

import arvados
import arvados_cwl
import cwltool.process
from schema_salad.ref_resolver import Loader

if not os.getenv('ARVADOS_DEBUG'):
    logging.getLogger('arvados.cwl-runner').setLevel(logging.WARN)
    logging.getLogger('arvados.arv-run').setLevel(logging.WARN)


class TestJob(unittest.TestCase):

    # The test passes no builder.resources
    # Hence the default resources will apply: {'cores': 1, 'ram': 1024, 'outdirSize': 1024, 'tmpdirSize': 1024}
    def test_run(self):
        runner = mock.MagicMock()
        runner.project_uuid = "zzzzz-8i9sb-zzzzzzzzzzzzzzz"
        runner.ignore_docker_for_reuse = False
        runner.num_retries = 0
        document_loader, avsc_names, schema_metadata, metaschema_loader = cwltool.process.get_schema("v1.0")

        tool = {
            "inputs": [],
            "outputs": [],
            "baseCommand": "ls",
            "arguments": [{"valueFrom": "$(runtime.outdir)"}]
        }
        make_fs_access=functools.partial(arvados_cwl.CollectionFsAccess, api_client=runner.api)
        arvtool = arvados_cwl.ArvadosCommandTool(runner, tool, work_api="jobs", avsc_names=avsc_names,
                                                 basedir="", make_fs_access=make_fs_access, loader=Loader({}))
        arvtool.formatgraph = None
        for j in arvtool.job({}, mock.MagicMock(), basedir="", make_fs_access=make_fs_access):
            j.run()
            runner.api.jobs().create.assert_called_with(
                body={
                    'owner_uuid': 'zzzzz-8i9sb-zzzzzzzzzzzzzzz',
                    'runtime_constraints': {},
                    'script_parameters': {
                        'tasks': [{
                            'task.env': {'HOME': '$(task.outdir)', 'TMPDIR': '$(task.tmpdir)'},
                            'command': ['ls', '$(task.outdir)']
                        }],
                    },
                    'script_version': 'master',
                    'minimum_script_version': '9e5b98e8f5f4727856b53447191f9c06e3da2ba6',
                    'repository': 'arvados',
                    'script': 'crunchrunner',
                    'runtime_constraints': {
                        'docker_image': 'arvados/jobs',
                        'min_cores_per_node': 1,
                        'min_ram_mb_per_node': 1024,
                        'min_scratch_mb_per_node': 2048 # tmpdirSize + outdirSize
                    }
                },
                find_or_create=True,
                filters=[['repository', '=', 'arvados'],
                         ['script', '=', 'crunchrunner'],
                         ['script_version', 'in git', '9e5b98e8f5f4727856b53447191f9c06e3da2ba6'],
                         ['docker_image_locator', 'in docker', 'arvados/jobs']]
            )

    # The test passes some fields in builder.resources
    # For the remaining fields, the defaults will apply: {'cores': 1, 'ram': 1024, 'outdirSize': 1024, 'tmpdirSize': 1024}
    def test_resource_requirements(self):
        runner = mock.MagicMock()
        runner.project_uuid = "zzzzz-8i9sb-zzzzzzzzzzzzzzz"
        runner.ignore_docker_for_reuse = False
        runner.num_retries = 0
        arvados_cwl.add_arv_hints()

        document_loader, avsc_names, schema_metadata, metaschema_loader = cwltool.process.get_schema("v1.0")


        tool = {
            "inputs": [],
            "outputs": [],
            "hints": [{
                "class": "ResourceRequirement",
                "coresMin": 3,
                "ramMin": 3000,
                "tmpdirMin": 4000
            }, {
                "class": "http://arvados.org/cwl#RuntimeConstraints",
                "keep_cache": 512,
                "outputDirType": "keep_output_dir"
            }, {
                "class": "http://arvados.org/cwl#APIRequirement",
            }],
            "baseCommand": "ls"
        }
        make_fs_access=functools.partial(arvados_cwl.CollectionFsAccess, api_client=runner.api)
        arvtool = arvados_cwl.ArvadosCommandTool(runner, tool, work_api="jobs", avsc_names=avsc_names,
                                                 make_fs_access=make_fs_access, loader=Loader({}))
        arvtool.formatgraph = None
        for j in arvtool.job({}, mock.MagicMock(), basedir="", make_fs_access=make_fs_access):
            j.run()
        runner.api.jobs().create.assert_called_with(
            body={
                'owner_uuid': 'zzzzz-8i9sb-zzzzzzzzzzzzzzz',
                'runtime_constraints': {},
                'script_parameters': {
                    'tasks': [{
                        'task.env': {'HOME': '$(task.outdir)', 'TMPDIR': '$(task.tmpdir)'},
                        'task.keepTmpOutput': True,
                        'command': ['ls']
                    }]
            },
            'script_version': 'master',
                'minimum_script_version': '9e5b98e8f5f4727856b53447191f9c06e3da2ba6',
                'repository': 'arvados',
                'script': 'crunchrunner',
                'runtime_constraints': {
                    'docker_image': 'arvados/jobs',
                    'min_cores_per_node': 3,
                    'min_ram_mb_per_node': 3000,
                    'min_scratch_mb_per_node': 5024, # tmpdirSize + outdirSize
                    'keep_cache_mb_per_task': 512
                }
            },
            find_or_create=True,
            filters=[['repository', '=', 'arvados'],
                     ['script', '=', 'crunchrunner'],
                     ['script_version', 'in git', '9e5b98e8f5f4727856b53447191f9c06e3da2ba6'],
                     ['docker_image_locator', 'in docker', 'arvados/jobs']])

    @mock.patch("arvados.collection.CollectionReader")
    def test_done(self, reader):
        api = mock.MagicMock()

        runner = mock.MagicMock()
        runner.api = api
        runner.project_uuid = "zzzzz-8i9sb-zzzzzzzzzzzzzzz"
        runner.num_retries = 0
        runner.ignore_docker_for_reuse = False

        reader().open.return_value = []
        api.collections().list().execute.side_effect = ({"items": []},
                                                        {"items": [{"manifest_text": "XYZ"}]})

        arvjob = arvados_cwl.ArvadosJob(runner)
        arvjob.name = "testjob"
        arvjob.builder = mock.MagicMock()
        arvjob.output_callback = mock.MagicMock()
        arvjob.collect_outputs = mock.MagicMock()

        arvjob.done({
            "state": "Complete",
            "output": "99999999999999999999999999999993+99",
            "log": "99999999999999999999999999999994+99",
            "uuid": "zzzzz-8i9sb-zzzzzzzzzzzzzzz"
        })

        api.collections().list.assert_has_calls([
            mock.call(),
            mock.call(filters=[['owner_uuid', '=', 'zzzzz-8i9sb-zzzzzzzzzzzzzzz'],
                          ['portable_data_hash', '=', '99999999999999999999999999999993+99'],
                          ['name', '=', 'Output 9999999 of testjob']]),
            mock.call().execute(num_retries=0),
            mock.call(limit=1, filters=[['portable_data_hash', '=', '99999999999999999999999999999993+99']],
                 select=['manifest_text']),
            mock.call().execute(num_retries=0)])

        api.collections().create.assert_called_with(
            ensure_unique_name=True,
            body={'portable_data_hash': '99999999999999999999999999999993+99',
                  'manifest_text': 'XYZ',
                  'owner_uuid': 'zzzzz-8i9sb-zzzzzzzzzzzzzzz',
                  'name': 'Output 9999999 of testjob'})

    @mock.patch("arvados.collection.CollectionReader")
    def test_done_use_existing_collection(self, reader):
        api = mock.MagicMock()

        runner = mock.MagicMock()
        runner.api = api
        runner.project_uuid = "zzzzz-8i9sb-zzzzzzzzzzzzzzz"
        runner.num_retries = 0

        reader().open.return_value = []
        api.collections().list().execute.side_effect = ({"items": [{"uuid": "zzzzz-4zz18-zzzzzzzzzzzzzz2"}]},)

        arvjob = arvados_cwl.ArvadosJob(runner)
        arvjob.name = "testjob"
        arvjob.builder = mock.MagicMock()
        arvjob.output_callback = mock.MagicMock()
        arvjob.collect_outputs = mock.MagicMock()

        arvjob.done({
            "state": "Complete",
            "output": "99999999999999999999999999999993+99",
            "log": "99999999999999999999999999999994+99",
            "uuid": "zzzzz-8i9sb-zzzzzzzzzzzzzzz"
        })

        api.collections().list.assert_has_calls([
            mock.call(),
            mock.call(filters=[['owner_uuid', '=', 'zzzzz-8i9sb-zzzzzzzzzzzzzzz'],
                               ['portable_data_hash', '=', '99999999999999999999999999999993+99'],
                               ['name', '=', 'Output 9999999 of testjob']]),
            mock.call().execute(num_retries=0)])

        self.assertFalse(api.collections().create.called)


class TestWorkflow(unittest.TestCase):
    # The test passes no builder.resources
    # Hence the default resources will apply: {'cores': 1, 'ram': 1024, 'outdirSize': 1024, 'tmpdirSize': 1024}
    @mock.patch("arvados.collection.Collection")
    def test_run(self, mockcollection):
        arvados_cwl.add_arv_hints()

        api = mock.MagicMock()
        api._rootDesc = arvados.api('v1')._rootDesc
        runner = arvados_cwl.ArvCwlRunner(api)
        self.assertEqual(runner.work_api, 'jobs')

        runner.project_uuid = "zzzzz-8i9sb-zzzzzzzzzzzzzzz"
        runner.ignore_docker_for_reuse = False
        runner.num_retries = 0
        document_loader, avsc_names, schema_metadata, metaschema_loader = cwltool.process.get_schema("v1.0")

        tool, metadata = document_loader.resolve_ref("tests/wf/scatter2.cwl")
        metadata["cwlVersion"] = tool["cwlVersion"]

        mockcollection().portable_data_hash.return_value = "99999999999999999999999999999999+118"

        make_fs_access=functools.partial(arvados_cwl.CollectionFsAccess, api_client=runner.api)
        arvtool = arvados_cwl.ArvadosWorkflow(runner, tool, work_api="jobs", avsc_names=avsc_names,
                                              basedir="", make_fs_access=make_fs_access, loader=document_loader,
                                              makeTool=runner.arv_make_tool, metadata=metadata)
        arvtool.formatgraph = None
        it = arvtool.job({}, mock.MagicMock(), basedir="", make_fs_access=make_fs_access)
        it.next().run()
        it.next().run()

        with open("tests/wf/scatter2_subwf.cwl") as f:
            subwf = f.read()

        mockcollection().open().__enter__().write.assert_has_calls([mock.call(subwf)])
        mockcollection().open().__enter__().write.assert_has_calls([mock.call('{sleeptime: 5}')])

        runner.api.jobs().create.assert_called_with(
            body={
                'minimum_script_version': '9e5b98e8f5f4727856b53447191f9c06e3da2ba6',
                'repository': 'arvados',
                'script_version': 'master',
                'script': 'crunchrunner',
                'script_parameters': {
                    'tasks': [{'task.env': {
                        'HOME': '$(task.outdir)',
                        'TMPDIR': '$(task.tmpdir)'},
                               'task.vwd': {
                                   'workflow.cwl': '$(task.keep)/99999999999999999999999999999999+118/workflow.cwl',
                                   'cwl.input.yml': '$(task.keep)/99999999999999999999999999999999+118/cwl.input.yml'
                               },
                    'command': [u'cwltool', u'--no-container', u'--move-outputs', u'--preserve-entire-environment', u'workflow.cwl#main', u'cwl.input.yml'],
                    'task.stdout': 'cwl.output.json'}]},
                'runtime_constraints': {
                    'min_scratch_mb_per_node': 2048,
                    'min_cores_per_node': 1,
                    'docker_image': 'arvados/jobs',
                    'min_ram_mb_per_node': 1024
                },
                'owner_uuid': 'zzzzz-8i9sb-zzzzzzzzzzzzzzz'},
            filters=[['repository', '=', 'arvados'],
                     ['script', '=', 'crunchrunner'],
                     ['script_version', 'in git', '9e5b98e8f5f4727856b53447191f9c06e3da2ba6'],
                     ['docker_image_locator', 'in docker', 'arvados/jobs']],
            find_or_create=True)

    def test_default_work_api(self):
        arvados_cwl.add_arv_hints()

        api = mock.MagicMock()
        api._rootDesc = arvados.api('v1')._rootDesc
        del api._rootDesc.get('resources')['jobs']['methods']['create']
        runner = arvados_cwl.ArvCwlRunner(api)
        self.assertEqual(runner.work_api, 'containers')
