var mapA;
var out;
  
function init()
{

	  // Check browser supports File loading with JS
	if (window.File && window.FileReader && window.FileList && window.Blob) 
	{
		console.log('Great success! All the File APIs are supported.')
		document.getElementById('fileinput').addEventListener('change', readSingleFile, false);
		out = document.getElementById('output');
	} 
	else 
	{
		alert('Loading files is not supported in this browser');
	}
 }
  
 
  function readSingleFile(evt) 
  {
	    var file = evt.target.files[0]; 
	    var filename = file.name;
	    
	    if (file) 
	    {
	      var reader = new FileReader();
	      
	      reader.onload = function(e) 
	      { 
		      var contents = e.target.result;
		      mapA = JSON.parse(contents);
		      printMap(mapA);
	      }
	      reader.readAsText(file);
	    } 
	    else { 
	      alert("Failed to load file");
	    }
	  }

  function printMap(data){

	  /*
// mapping.connections
clipMax: "none"
clipMin: "none"
expression: "d0=s0*(-1)+(1)"
mode: "linear"
mute: 0
range: Array[4]

// mapping.destinations
device: "delaydesigner.1"
id: "d0"
signal: "14_channel/control/79/globa

// mapping.sources
device: "71tstick.1"
id: "s0"
signal: "instrument/grip/tip/touch"

*/

	  if(!data.mapping || !data.mapping.sources || !data.mapping.destinations || !data.mapping.connections)
		  return;

	//
	  for (var i=0; i<data.mapping.sources.length; i++)
	  {
		  var source = data.mapping.sources[i];
		  var node = document.createElement("p");
		  node.innerHTML = source.name;
		  out.appendChild(node);
	  }
	  
  }