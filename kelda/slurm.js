const kelda = require('kelda');
const mustache = require('mustache');

const slurmConfTemplate = `ControlMachine={{controllerHost}}
SlurmctldPort=6817
SlurmdPort=6818
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
  constructor(apiServer, n, mungeKey) {
    this.controller = new kelda.Container({
			name: 'slurm-controller',
			image: 'quay.io/kklin/slurm',
      env: {
        ARVADOS_API_HOST: `${apiServer.getHostname()}:${apiServer.port}`,
        ARVADOS_API_TOKEN: new kelda.Secret('crunch-dispatcher-api-token'),
        ARVADOS_API_HOST_INSECURE: "true",
      },
      // TODO: We're basically using `sh` as an init system by backgrounding
      // the process. This is bad because if munged or slurmctld crashes,
      // nothing will restart it. Instead, the container should bundle a real
      // init system, and handle managing the backgrounded process.
			command: ['sh', '-c',
				'chown munge /etc/munge/munge.key; ' +
				'chmod 0400 /etc/munge/munge.key; ' +
				'sudo -u munge munged & ' +
				'slurmctld -D & ' +
				'crunch-dispatch-slurm',
			],
    });
    kelda.allowTraffic(this.controller, apiServer, apiServer.port);

    this.computeNodes = Array(n).fill().map(() => new kelda.Container({
			name: 'slurm-compute',
			image: 'quay.io/kklin/slurm',
			command: ['sh', '-c',
				'chown munge /etc/munge/munge.key; ' +
				'chmod 0400 /etc/munge/munge.key; ' +
				'sudo -u munge munged & ' +
				'slurmd -D',
			],
    }));

    const nodeNames = this.computeNodes.map((c) => c.getHostname()).join(',');
    const slurmConf = mustache.render(slurmConfTemplate, {
			controllerHost: this.controller.getHostname(),
    	nodeNames,
		});
		this.computeNodes.concat(this.controller).forEach((c) => {
			c.filepathToContent = {
				'/etc/slurm-llnl/slurm.conf': slurmConf,
				'/etc/munge/munge.key': mungeKey,
			};
		})

    // arv-mount connects to the API server. It shouldn't go via the public
    // internet though..
    kelda.allowTraffic(this.computeNodes, kelda.publicInternet, 444);
  }

  deploy(infra) {
		this.computeNodes.forEach(c => c.deploy(infra));
		this.controller.deploy(infra);
	}
}

module.exports = { SLURM };
