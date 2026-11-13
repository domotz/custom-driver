// Simulated status.zoom.us page. Shape follows the Atlassian Statuspage public page markup: one
// "component-container border-color" per component, holding the component name, a "?" tooltip marker and
// the status text ("Operational", "Degraded Performance", "Partial Outage" ...).
const reply = require("../../replies");

function component(id, name, status, cls) {
    return `
<div class="component-container border-color">
  <div class="component-inner-container status-${cls} showcase-component" data-component-id="${id}" data-component-status="${cls}">
    <span class="name">
      ${name}
    </span>
    <span class="tooltip-base tool" title="" data-original-title="Zoom ${name}">?</span>
    <span class="component-status">
      ${status}
    </span>
  </div>
</div>`;
}

const PAGE = `<!DOCTYPE html>
<html lang="en"><head><title>Zoom Status</title></head>
<body class="status index">
<div class="layout-content status status-index premium">
  <div class="container">
    <div class="page-status status-none"><span class="status font-large">All Systems Operational</span></div>
    <div class="components-section font-regular">
      <div class="components-container one-column">
${component("c1", "Zoom Meetings", "Operational", "none")}
${component("c2", "Zoom Phone", "Degraded Performance", "minor")}
${component("c3", "Zoom Webinars", "Partial Outage", "major")}
      </div>
    </div>
  </div>
</div>
</body></html>`;

const call = () => ({ kind: "http", method: "get", host: "status.zoom.us", target: "/", reply: reply.http(200, PAGE) });

module.exports = {
    cases: [{
        name: "three components, two not operational",
        entryPoints: {
            validate: { calls: [call()] },
            get_status: { calls: [call()] }
        }
    }]
};
