var Service = require('node-windows').Service;

var svc = new Service({
  name: 'MiServidorNodeEC2',
  // ¡CRÍTICO! Debes incluir la ruta del script, aunque solo vayas a desinstalar.
  script: 'C:\BlessedBox\Blessed-Box-BackEnd\app.js' 
});

svc.on('uninstall', function(){
  console.log('Servicio desinstalado.');
});

svc.uninstall();
