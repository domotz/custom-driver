// Simulated Docker 19.03.15 `docker image ls --format "{{ json . }}"` output. Shape follows the Docker CLI
// formatting docs: one JSON object per line with Containers, CreatedAt ("2021-02-02 21:42:51 +0000 UTC"),
// CreatedSince, Digest, ID, Repository, SharedSize, Size (go-units HumanSize: "133MB", "1.23GB", "1.84kB"),
// Tag, UniqueSize and VirtualSize.
const reply = require("../../replies");

const image = (repo, tag, id, createdAt, since, size) => JSON.stringify({
    Containers: "N/A", CreatedAt: createdAt, CreatedSince: since, Digest: "<none>", ID: id,
    Repository: repo, SharedSize: "N/A", Size: size, Tag: tag, UniqueSize: "N/A", VirtualSize: size
});

const OUT = [
    image("nginx", "1.19", "ae2feff98a0c", "2020-12-15 22:10:26 +0000 UTC", "2 months ago", "133MB"),
    image("nginx", "latest", "f6d0b4767a6c", "2021-02-02 21:42:51 +0000 UTC", "3 weeks ago", "133MB"),
    image("ubuntu", "20.04", "f63181f19b2f", "2021-01-20 01:23:54 +0000 UTC", "4 weeks ago", "72.9MB"),
    image("postgres", "13", "7a0ff1e1b4c2", "2021-02-09 05:30:12 +0000 UTC", "2 weeks ago", "314MB"),
    image("tensorflow/tensorflow", "latest-gpu", "d1b2a3c4e5f6", "2021-01-05 14:01:33 +0000 UTC", "6 weeks ago", "1.23GB"),
    image("hello-world", "latest", "bf756fb1ae65", "2019-12-31 18:51:00 +0000 UTC", "14 months ago", "1.84kB")
].join("\n") + "\n";

const call = () => ({ kind: "ssh", method: "sendSSHCommand", target: 'docker image ls --format "{{ json . }}"', reply: reply.ssh(OUT) });

module.exports = {
    cases: [{
        name: "docker 19.03.15",
        entryPoints: {
            validate: { calls: [call()] },
            get_status: { calls: [call()] }
        }
    }]
};
