// service-install.js
var Service = require('node-windows').Service;

var svc = new Service({
  name: 'MiServidorNodeEC2',
  description: 'Node.js server for my web application.',
  
  script: 'C:\BlessedBox\Blessed-Box-BackEnd\app.js',
  workingDirectory: 'C:\BlessedBox\Blessed-Box-BackEnd', 
  
  // CRITICAL LINE for diagnosis
  logDirectory: 'C:\BlessedBox\Blessed-Box-BackEnd\logs',
  
  nodeOptions: [
    '--max_old_space_size=2048'
  ]
});

svc.on('install', function(){
  console.log('Service installed successfully. Starting...');
  svc.start();
});

svc.on('error', function(err){
  console.error('An error occurred during installation or service:', err);
});

svc.install();
