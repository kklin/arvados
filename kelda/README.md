# Deploying with Kelda

This directory contains a Kelda deployment for booting an Arvados cluster.
Specifically, it boots the API server, workbench, Keep, and Crunch.

Notably missing is the Git server, so CWL jobs cannot be run.

## Booting

These instructions assume you've installed Kelda. See the Kelda
[Quick Start](http://docs.kelda.io/#quick-start) for instructions.

1. *Reserve a floating IP.* Using a floating IP allows the applications to
   always be deployed to the same IP, rather than a random IP each time the
   cluster is restarted.
   
   A floating IP can be reserved on Amazon
   [here](https://console.aws.amazon.com/ec2/v2/home?region=us-west-1#Addresses).
   Make sure that the IP is allocated in the region that the machines will be
   booted in.

2. *Set the floating IP in [consts.js](consts.js).* Replace `<FLOATING IP>` in
   the `exports.floatingIP` variable with the IP allocated by the cloud
   provider. For example,

   ```
   exports.floatingIP = '13.56.215.88';
   ```

   *Note* the `<FLOATING IP>` string in the `if` check should not be replaced.

3. *Generate an SSL certificate*. The HTTPS components need a certificate to
   secure communication from the public internet. Run

   ```
   ./config/ssl/cert-gen.sh <FLOATING IP>
   ```

   where `<FLOATING IP>` is replaced with the IP allocated in step 1, and
   used in step 2.

   The `config/ssl` directory should now contain a certificate and key.

   ```
   $ tree config/ssl
   config/ssl
   ├── cert-gen.sh
   ├── certificate.pem
   └── key.pem
   ```

4. *Optional: Trust the generated certificate*. By default, browsers treat
   self-signed certificates as insecure. Therefore, the generated certificate
   must be manually trusted through the OS settings.  If you skip this step,
   you'll have to manually override browser SSL warnings when connecting to
   workbench.

   To do this on On Mac OS:
   1. Open the "Keychain Access" application.
   2. Click "File" in the menu at the top left.
   3. Click "Import Items...".
   4. Navigate to the generated `certificate.pem` and click "Open".
   5. Double click on the certificate and change the trust level to "Always
      Trust". The certificate will be named "arvados-test-cert".

5. *Start the Kelda daemon*. Run `kelda daemon` in a terminal window. This
   process should remain running for the duration of the demo, and handles
   interacting with the cloud to boot the machines and containers.

6. *Install the Arvados blueprint dependencies*. Run `npm install .` in the
   Arvados blueprint directory (the directory containing this README).

7. *Run the Arvados blueprint*. Run `kelda run ./deploy.js`.

8. *Wait for the containers to start*. It will take a couple minutes for the
   machines and containers to start. Check on the deployment status with `kelda
   show` until all the containers are either `running` or `Waiting for
   secrets`.

   ```
   MACHINE         ROLE      PROVIDER    REGION       SIZE         PUBLIC IP        STATUS
   i-03418c4202    Master    Amazon      us-west-1    m4.xlarge    52.53.222.77     connected
   i-0d3159dd58    Worker    Amazon      us-west-1    m4.xlarge    13.56.215.88     connected
   i-0c8a1f83d9    Worker    Amazon      us-west-1    m4.xlarge    54.219.178.61    connected
   i-08251c3ffb    Worker    Amazon      us-west-1    m4.xlarge    13.56.212.196    connected
   
   CONTAINER       MACHINE         COMMAND                              HOSTNAME                    STATUS                                                CREATED          PUBLIC IP
   22c5aae95be6    i-08251c3ffb    postgres:9.5                         postgres                    running                                               6 minutes ago
   68f384cec7e8    i-08251c3ffb    quay.io/kklin/slurm sh -c chow...    slurm-controller            Waiting for secrets: [crunch-dispatcher-api-token]
   863d672d6dc2    i-08251c3ffb    quay.io/kklin/arvados-keep sh ...    arvados-keep-store2         running                                               5 minutes ago
   b20a6f6f8bbf    i-08251c3ffb    quay.io/kklin/arvados-keep sh ...    arvados-keep-store          running                                               5 minutes ago
   c083850ff1c6    i-08251c3ffb    quay.io/kklin/slurm sh -c chow...    slurm-compute2              running                                               4 minutes ago
   
   16474ad18397    i-0c8a1f83d9    quay.io/kklin/arvados-keep kee...    arvados-keep-web            Waiting for secrets: [keep-web-api-token]
   271474f1d9a6    i-0c8a1f83d9    quay.io/kklin/arvados-ws ws          arvados-ws                  running                                               5 minutes ago
   80286f4fefd1    i-0c8a1f83d9    quay.io/kklin/arvados-shell-se...    arvados-shell-server        Waiting for secrets: [shell-server-api-token]
   93455a2b7a00    i-0c8a1f83d9    quay.io/kklin/arvados-keep kee...    arvados-keep-proxy          Waiting for secrets: [keep-proxy-api-token]
   f1389e126f43    i-0c8a1f83d9    quay.io/kklin/slurm sh -c chow...    slurm-compute               running                                               5 minutes ago
   
   395c43833aab    i-0d3159dd58    quay.io/kklin/arvados-workbenc...    arvados-workbench           running                                               2 minutes ago    13.56.215.88:443
   56ba20c77ef2    i-0d3159dd58    quay.io/kklin/arvados-sso-serv...    arvados-sso-server          running                                               3 minutes ago
   66d342c4bedd    i-0d3159dd58    nginx:1.10                           arvados-keep-proxy-https    running                                               4 minutes ago    13.56.215.88:25107
   749e979fae13    i-0d3159dd58    nginx:1.10                           arvados-sso-server-https    running                                               4 minutes ago    13.56.215.88:3002
   a24c15009b63    i-0d3159dd58    quay.io/kklin/arvados-api-serv...    arvados-api-server          running                                               3 minutes ago    13.56.215.88:444
   d067f188f66b    i-0d3159dd58    nginx:1.10                           arvados-keep-web-https      running                                               4 minutes ago    13.56.215.88:9002
   e5fa6ca741d5    i-0d3159dd58    nginx:1.10                           arvados-ws-https            running                                               4 minutes ago    13.56.215.88:9003
   ```

9. *Login to the Workbench*. Step 10 requires that a user first log in to the
   workbench so that the user can be made an admin. The default credentials are:

   ```
   username: test@example.com
   password: passw0rd
   ```

   The workbench should be running at `https://<FLOATING IP>`. The IP can also
   be found in the `PUBLIC IP` column of the `kelda show` output for the
   `arvados-workbench` container.

10. *Setup initial trust*. Arvados requires that commands be run in order to
    set a user as an admin, and to make the API server trust the workbench. Run
    these commands with `./step1.sh`.

11. *Generate API tokens*. Several components require API tokens in order to
    operate (these are the containers with the "Waiting for secrets" status in
    `kelda show`). Generate these tokens by running `./step2.sh <ADMIN API
    TOKEN>`. The admin API token can be found in the Workbench UI.

    `step2.sh` will generate API tokens for the containers that require them,
    and securely pass them to Kelda. The status for these containers should
    change from `Waiting for secrets` to `running` within a minute or two.

12. The Arvados cluster is now ready to use! To access the shell server, run
    `kelda ssh -t arvados-shell-server bash`.
    
    See the [testing](#testing) section for how we tested the cluster.

13. When finished with the cluster, make sure to destroy the VMs with `kelda
    stop` to avoid unnecessary charges.

## Testing

We tested two parts of the deployment: the interaction between the workbench
and Keep, and booting a container from the shell server via Crunch. A full end
to end test didn't seem possible without the Git server. Arvados is definitely
more complicated than these two tests, but the tests are documented so that
readers can know exactly what is expected to work at this time.

### Uploading a File to Keep

1. Click "Projects" -> "Home"
2. Click "Add data" -> "Upload files from my computer"
3. Choose a file to upload, and click "Start". A green flag with the text
   "Done!" should appear.
4. Click "Files" and refresh the page. The uploaded file should appear.

### Booting a Container

1. SSH into the shell server with `kelda ssh -t arvados-shell-server bash`.
2. Run `arv-keepdocker --pull arvados/jobs latest`
3. Follow the example under "Test the dispatcher" at
   http://doc.arvados.org/install/crunch2-slurm/install-test.html.  Testing
   squeue is not necessary.

## Configuration

The `numWorkers`, `slurmScale`, and `keepScale` variables in
[consts.js](consts.js) can be tweaked to change the deployment. To deploy
changes after changing a variable, `kelda run ./deploy.js` must be run again.

## Known Issues

### Uploading to Keep from the Workbench Fails with "Bad response from slice upload"
It's possible that the Keep Proxy cache hasn't picked up the Keep
Stores. The cache is updated every 5 minutes, so if the arvados-keep-store
container starts before the arvados-shell-server (which registers the Keep
servers), the Keep Proxy might believe that there aren't any Keep Stores in
the cluster. The Keep Proxy can be refeshed by running:

```
kelda ssh arvados-keep-proxy kill -hup 1
```

### "502 Bad Gateway" Errors After Modifying Container Attributes
This shouldn't happen during normal operation, but if a container's attributes
(such as its environment variables) are modified after its booted, and the
blueprint is re-deployed, the container will get restarted with a *new IP*,
possibly confusing the HTTPS proxies. There is an [open
issue](https://github.com/kelda/kelda/issues/1394) in the Kelda repo on this
bug.

The current fix is to stop _all_ containers with `kelda stop -containers`
before running the modified blueprint. Note that the `./step1.sh` and
`./step2.sh` scripts will need to be re-run.

### Invalid Tokens After Restarting the Cluster with `kelda stop -containers`
If the cluster is redeployed by running `kelda stop -containers` followed by
`kelda run`, the containers that depend on API tokens will start with the
tokens for the old cluster. However, these tokens will be invalid because the
database was also restarted.

Make sure to run `./step1.sh` and `./step2.sh` again so that these containers
get valid tokens. The containers will automatically restart when the tokens
are updated by running the scripts.

## Next Steps
- Setup the Arvados Git server. The Git server architecture doesn't work very
  well in a containerized architecture, so the Arvados and Kelda teams should
  work together to figure out the best way to deploy it.
  - The Arvados Git syncing script requires that the Gitolite admin repo be
    pulled first. Because the repo is pulled over SSH, this implies that the
    setup must happen _after_ the SSH server starts. This is a bit weird in the
    container model of having a single long-running process since it'll be
    tricky to start the setup process after the SSH server starts.
- Remove the need for `step1.sh` and `step2.sh`.
  - The `step1.sh` and `step2.sh` scripts are copied from the manual setup
    instructions, but it might be possible for their functionality to be
    automated by scripts that run automatically when the containers start.
- Improve the Arvados Docker images.
  - The images should be hosted by Arvados.
  - Minimize the image sizes. No cleanup is done right now after installing the
    applications.
  - Fix permissions issue with Passenger in the Workbench container. The
    Dockerfile installs the application as the `root` user, but Passenger runs
    it as the `nobody` user. By default, there's an error is thrown when a
    project is created in the Workbench because Passenger tries to create a
    folder in the `tmp` directory as the `nobody` user. `step2.sh` works around
    this by `chown`ing the directory at runtime, but the Dockerfile should be
    fixed so that the ownership is consistent.
- Secure the deployment.
  - There are multiple places where `kelda.Secret`s should be used rather than
    plaintext secrets.
      - Database credentials, both in the Postgres initialization script, and
        in application config.
      - Secret tokens for the Arvados applications.
      - The Workbench admin user (test@example.com).
- Figure out the right addresses to publish to the API server.
  - There are several cases where rather than connecting to another container
    over the private network, it connects to the container's public address.
    For example, the shell server connects to the Keep proxy at its public
    address. I suspect this is because the API server is configured with the
    proxy's public address for use with Workbench.
