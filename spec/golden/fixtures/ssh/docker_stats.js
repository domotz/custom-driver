// Simulated Docker 19.03 `docker stats --no-stream --format "table {{.Container}}\t{{.Name}}\t{{.CPUPerc}}\t{{.MemPerc}}"`
// output. Shape follows the Docker CLI docs: a "table" format prints a header (CONTAINER ID for {{.Container}}) then one
// tab-aligned line per running container, CPU and memory as "12.34%".
const reply = require("../../replies");

const COMMAND = "docker stats --no-stream --format \"table {{.Container}}\t{{.Name}}\t{{.CPUPerc}}\t{{.MemPerc}}\"";

const STATS = [
    "CONTAINER ID        NAME                CPU %               MEM %",
    "a1b2c3d4e5f6        web-frontend        0.07%               1.20%",
    "b2c3d4e5f6a1        postgres-main       23.45%              41.87%",
    "c3d4e5f6a1b2        redis-cache         96.10%              88.03%",
    ""
].join("\n");

const call = () => ({ kind: "ssh", method: "sendSSHCommand", target: COMMAND, reply: reply.ssh(STATS) });

module.exports = {
    cases: [{
        name: "docker 19.03",
        entryPoints: {
            validate: { calls: [call()] },
            get_status: { calls: [call()] }
        }
    }]
};
