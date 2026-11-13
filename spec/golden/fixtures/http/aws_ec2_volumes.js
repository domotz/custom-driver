// Simulated AWS EC2 replies. Shape follows the EC2 API reference for DescribeVolumes (API version 2016-11-15, Query
// protocol, XML reply): <DescribeVolumesResponse><requestId/><volumeSet><item> volumeId, size, availabilityZone,
// status, createTime, attachmentSet/item { volumeId, instanceId, device, status, attachTime, deleteOnTermination },
// volumeType ... </item></volumeSet></DescribeVolumesResponse>. The driver ships with region "ADD_REGION" and
// instance id "ADD_INSTANCE_ID" (placeholders), hence the host and the Filter.1.Value below.
// The reply is paged (nextToken). The first volume is restored from a snapshot; the second was created blank, so it
// carries a self-closing <snapshotId/>.
const reply = require("../../replies");

const item = (id, snap, size, status, create, device, attStatus, attach) => `
    <item>
      <volumeId>${id}</volumeId>
      <size>${size}</size>
      ${snap ? `<snapshotId>${snap}</snapshotId>` : "<snapshotId/>"}
      <availabilityZone>eu-west-1a</availabilityZone>
      <status>${status}</status>
      <createTime>${create}</createTime>
      <attachmentSet>
        <item>
          <volumeId>${id}</volumeId>
          <instanceId>ADD_INSTANCE_ID</instanceId>
          <device>${device}</device>
          <status>${attStatus}</status>
          <attachTime>${attach}</attachTime>
          <deleteOnTermination>true</deleteOnTermination>
        </item>
      </attachmentSet>
      <volumeType>gp3</volumeType>
      <iops>3000</iops>
      <encrypted>true</encrypted>
      <multiAttachEnabled>false</multiAttachEnabled>
    </item>`;

const page = (items, nextToken) => `<?xml version="1.0" encoding="UTF-8"?>
<DescribeVolumesResponse xmlns="http://ec2.amazonaws.com/doc/2016-11-15/">
  <requestId>59dbff89-35bd-4eac-99ed-be587EXAMPLE</requestId>
  <volumeSet>${items}
  </volumeSet>${nextToken ? `
  <nextToken>${nextToken}</nextToken>` : ""}
</DescribeVolumesResponse>`;

const QUERY = "/?Action=DescribeVolumes&Filter.1.Name=attachment.instance-id&Filter.1.Value=ADD_INSTANCE_ID&MaxResults=100";
const calls = () => [
    {
        kind: "http", method: "get", host: "ec2.ADD_REGION.amazonaws.com",
        target: QUERY + "&Version=2016-11-15",
        reply: reply.http(200, page(item("vol-049df61146c4d7901", "snap-0a1b2c3d4e5f60718", 8, "in-use", "2025-11-03T09:15:42.000Z", "/dev/xvda", "attached", "2025-11-03T09:15:43.000Z"), "eyJ2IjoiMiIsImMiOiJ0b2tlbiJ9"))
    },
    {
        kind: "http", method: "get", host: "ec2.ADD_REGION.amazonaws.com",
        target: QUERY + "&NextToken=eyJ2IjoiMiIsImMiOiJ0b2tlbiJ9&Version=2016-11-15",
        reply: reply.http(200, page(item("vol-0b2c3d4e5f6a7b8c9", "", 100, "error", "2025-12-20T17:45:10.000Z", "/dev/sdf", "attaching", "2025-12-20T17:46:00.000Z")))
    }
];

module.exports = {
    cases: [{
        name: "two volumes attached to the instance",
        entryPoints: {
            validate: { calls: calls() },
            get_status: { calls: calls() }
        }
    }]
};
