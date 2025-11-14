// service-install.js
var Service = require('node-windows').Service;

var svc = new Service({
  name: 'MiServidorNodeEC2',
  description: 'Servidor Node.js de mi aplicación web.',
  
  // Rutas insertadas: C:\BlessedBox\Blessed-Box-BackEnd\app.js
  script: 'C:\BlessedBox\Blessed-Box-BackEnd\app.js',
  workingDirectory: 'C:\BlessedBox\Blessed-Box-BackEnd', 
  
  nodeOptions: [
    '--max_old_space_size=2048'
  ]
});

svc.on('install', function(){
  console.log('Servicio instalado correctamente. Iniciando...');
  svc.start();
});

svc.on('error', function(err){
  console.error('Ocurrió un error en la instalación o el servicio:', err);
});

svc.install();
