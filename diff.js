var mapA;
var out;

var model;

var view;
var viewIndex;					// to index into viewData 
var viewData = new Array(3);	// data specific to the view, change 3 the number of views



function init()
{
	checkBrowserSupport();
	model = new LibMapperModel();
}


function checkBrowserSupport()
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
		
		reader.onload = function(e) { 
			var contents = e.target.result;
			mapA = JSON.parse(contents);
			initData(mapA);
		};
		reader.readAsText(file);
	} 
	else { 
		alert("Failed to load file");
	}
}

function switch_mode(newMode)
{
	if(view)
	{
		// save view settings
		if(typeof view.save_view_settings == 'function')
			viewData[viewIndex] = view.save_view_settings();
		
		// tell the view to cleanup (ex: removing event listeners)
		view.cleanup();
	}
	
    $('#container').empty();
    switch(newMode)
    {
        case 'list':
            view = new listView(model);
            viewIndex = 0;
            view.init();
            break;
        case 'grid':
        	view = new GridView(document.getElementById('container'), model);
        	viewIndex = 1;
        	$('#saveLoadDiv').removeClass('disabled');
        	view.update_display();
        	break;
        case 'hive':
        	view = new HivePlotView(document.getElementById('container'), model);
        	viewIndex = 2;
            view.on_resize();
        	break;
        default:
            //console.log(newMode);
    }
    
    // load view settings if any
    if(viewData[viewIndex]){
	    if(typeof view.load_view_settings == 'function')
	    		view.load_view_settings(viewData[viewIndex]);
    }
}

function initData(data)
{

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
	
	var devicesTemp = [];
	
	
	for (var i=0; i<data.mapping.sources.length; i++)
	{
		var source = data.mapping.sources[i];
		
		if(arrIsUnique(source.device, devicesTemp))
		{
			devicesTemp.push(source.device.toString());
			var devArgs = new Object(); 
			devArgs.name = source.device;
			devArgs.n_inputs = 0;
			devArgs.n_outputs = 0;
			model.devices.add(source.device, devArgs);
		}
		
		var args = new Object(); 
		args.device_name = source.device;
		args.name = source.signal;
		args.id = source.id;
		model.signals.add(source.device+source.signal, args);
		
		// increment
		var dev = model.devices.get(source.device);
		dev.n_outputs = parseInt(dev.n_outputs) + 1;
	}
	for (var i=0; i<data.mapping.destinations.length; i++)
	{
		var source = data.mapping.destinations[i];
		
		if(arrIsUnique(source.device, devicesTemp))
		{
			devicesTemp.push(source.device.toString());
			var devArgs = new Object(); 
			devArgs.name = source.device;
			devArgs.n_inputs = 0;
			devArgs.n_outputs = 0;
			model.devices.add(source.device, devArgs);
		}
		
		var args = new Object(); 
		args.device_name = source.device;
		args.name = source.signal;
		args.id = source.id;
		model.signals.add(source.device+source.signal, args);
		
		// increment
		var dev = model.devices.get(source.device);
		dev.n_inputs = parseInt(dev.n_inputs) + 1;
	}
	
	console.log("done!");
}







