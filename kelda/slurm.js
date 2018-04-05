const kelda = require('kelda');
const mustache = require('mustache');
const consts = require('./consts');

const slurmConfTemplate = `ControlMachine={{controllerHost}}
SlurmctldPort=6817
SlurmdPort=6818
SrunPortRange={{minSrunPort}}-{{maxSrunPort}}
AuthType=auth/munge
StateSaveLocation=/tmp
SlurmdSpoolDir=/tmp/slurmd
SwitchType=switch/none
MpiDefault=none
SlurmctldPidFile=/var/run/slurmctld.pid
SlurmdPidFile=/var/run/slurmd.pid
ProctrackType=proctrack/pgid
CacheGroups=0
ReturnToService=2
TaskPlugin=task/affinity
#
# TIMERS
SlurmctldTimeout=300
SlurmdTimeout=300
InactiveLimit=0
MinJobAge=300
KillWait=30
Waittime=0
#
# SCHEDULING
SchedulerType=sched/backfill
SchedulerPort=7321
SelectType=select/cons_res
SelectTypeParameters=CR_CPU_Memory
FastSchedule=0
#
# LOGGING
SlurmctldDebug=3
#SlurmctldLogFile=
SlurmdDebug=3
#SlurmdLogFile=
JobCompType=jobcomp/none
#JobCompLoc=
JobAcctGatherType=jobacct_gather/none
#
# COMPUTE NODES
NodeName={{nodeNames}}
PartitionName=compute Nodes={{nodeNames}} Default=YES Shared=YES
`

class SLURM {
  constructor(apiServer, keepStores, n, mungeKey) {
    this.controller = new kelda.Container({
      name: 'slurm-controller',
      image: 'cure/arvados-slurm-runtime',
      env: {
        ARVADOS_API_TOKEN: `${consts.superUserSecret}`,
        ARVADOS_API_HOST: `${apiServer.getHostname()}:${apiServer.port}`,
        ARVADOS_API_HOST_INSECURE: "true",
      },
      // TODO: We're basically using `sh` as an init system by backgrounding
      // the process. This is bad because if munged or slurmctld crashes,
      // nothing will restart it. Instead, the container should bundle a real
      // init system, and handle managing the backgrounded process.
      command: ['sh', '-c',
        '/usr/local/bin/bootstrap.sh crunch-dispatch-slurm=' + consts.crunchDispatchSlurmVersion + ' && ' +
        'chown munge /etc/munge/munge.key; ' +
        'chmod 0400 /etc/munge/munge.key; ' +
        'sudo -u munge munged & ' +
        'slurmctld -D & ' +
        'crunch-dispatch-slurm',
      ],
    });
    kelda.allowTraffic(this.controller, apiServer, apiServer.port);

    // Let the hosts pull in a package
    // TODO: restrict this to apt.arvados.org
    kelda.allowTraffic(this.controller, kelda.publicInternet, 80);

    const dockerVolume = new kelda.Volume({
      name: 'docker',
      type: 'hostPath',
      path: '/var/run/docker.sock',
    });
    this.computeNodes = Array(n).fill().map(() => new kelda.Container({
      name: 'slurm-compute',
      image: 'cure/arvados-slurm-runtime',
      command: ['sh', '-c',
        '/usr/local/bin/bootstrap.sh python-arvados-python-client=' + consts.pythonArvadosPythonClientVersion + ' ' +
        'crunch-run=' + consts.crunchRunVersion + ' ' +
        'python-arvados-fuse=' + consts.pythonArvadosFuseVersion + ' && ' +
        'chown munge /etc/munge/munge.key; ' +
        'chmod 0400 /etc/munge/munge.key; ' +
        'sudo -u munge munged & ' +
        'slurmd -D',
      ],
      volumeMounts: [
        new kelda.VolumeMount({
          volume: dockerVolume,
          mountPath: dockerVolume.path,
        }),
      ],
      privileged: true,
    }));

    // srun listens on random ports.
    const srunPorts = new kelda.PortRange(60001, 63000);
    kelda.allowTraffic(this.computeNodes, this.controller, srunPorts);

    const nodeNames = this.computeNodes.map((c) => c.getHostname()).join(',');
    const slurmConf = mustache.render(slurmConfTemplate, {
      controllerHost: this.controller.getHostname(),
      minSrunPort: srunPorts.min,
      maxSrunPort: srunPorts.max,
      nodeNames,
    });
    this.computeNodes.concat(this.controller).forEach((c) => {
      c.filepathToContent = {
        '/etc/slurm-llnl/slurm.conf': slurmConf,
        '/etc/munge/munge.key': mungeKey,
      };
    })

    // The compute nodes register themselves with the controller.
    kelda.allowTraffic(this.computeNodes, this.controller, 6817);

    // The controller sends jobs to the compute nodes.
    kelda.allowTraffic(this.controller, this.computeNodes, 6818);

    // arv-mount connects to the API server. I'm not sure why it's also
    // connecting via the public internet though..
    kelda.allowTraffic(this.computeNodes, apiServer, 444);
    kelda.allowTraffic(this.computeNodes, kelda.publicInternet, 444);

    // The compute nodes pull data from Keep.
    kelda.allowTraffic(this.computeNodes, keepStores, keepStores[0].port);

    // Let the hosts pull in a package
    // TODO: restrict this to apt.arvados.org
    kelda.allowTraffic(this.computeNodes, kelda.publicInternet, 80);
  }

  deploy(infra) {
    this.computeNodes.forEach(c => c.deploy(infra));
    this.controller.deploy(infra);
  }
}

module.exports = { SLURM };
