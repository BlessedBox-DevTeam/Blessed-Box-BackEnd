var Service = require("node-windows").Service;

var svc = new Service({
  name: "MiServidorNodeEC2",
  // CRITICAL! You must include the script path, even if you're only uninstalling.
  script: "C:\BlessedBox\Blessed-Box-BackEnd\app.js"
});

svc.on("uninstall", function () {
  console.log("Service uninstalled.");
});

svc.uninstall();
