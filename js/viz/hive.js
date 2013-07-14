//+++++++++++++++++++++++++++++++++++++++++++ //
//		  	     Hive View Class		  	  //		 
//+++++++++++++++++++++++++++++++++++++++++++ //

function HivePlotView(container, model)
{
	this.svgNS = "http://www.w3.org/2000/svg";
	this.svgNSxlink = "http://www.w3.org/1999/xlink";

	var _self = this;
	this._container = container;
	this.model = model;
	
	this.mode = 0;

	// 0 for sources, 1 for destinations
	this.devs = [new Array(), new Array()];
	this.excludedDevs = [new Array(), new Array()];
	this.sigs = [new Array(), new Array()];
	this.nodes = [new Array(), new Array()];
	this.connectionsLines = [];

	this.svg;					// holding <SVG> elements for easy reference
	this.svgDim = [800, 600]; 	// x-y dimensions of the svg canvas
	this.inclusionTableWidth = 210;
	this.inclusionTablePadding = 8;

	this.groupColors = ["Cyan", "Orange", "Yellow", "Red", "DodgerBlue", "PeachPuff", "BlanchedAlmond", "DarkViolet", "PaleGreen", "Silver", "AntiqueWhite", "LightSteelBlue" ];
	this.pColors;
	this.initColorPointers();
	
	//Keyboard handlers
	document.onkeyup = function(e){
		_self.keyboardHandler(e);
	};
}

HivePlotView.prototype = {
	
	init : function () 
	{ 
		var _self = this;	// to pass to the instance of LibMApperMatrixView to event handlers
		var div, btn;		// to instantiate items
		
		this.devs = [[],[]];
		this.sigs = [[],[]];
		this.nodes = [[],[]];
		this.connectionsLines = [];
		
		$(this._container).empty();
//		$(this._container).css("min-width", "880px");
//		$(this._container).css("min-height", "580px");

		this.initColorPointers();
		
		var wrapper = document.createElement("div");
		this._container.appendChild(wrapper);
		
		this.svg = document.createElementNS(this.svgNS,"svg");
		this.svg.setAttribute("id", "HivePlotSVG");
		this.svg.setAttribute("xmlns", this.svgNS);
		this.svg.setAttribute("xmlns:xlink", this.svgNSxlink);
		this.svg.setAttribute("width", this.svgDim[0]);
		this.svg.setAttribute("height", this.svgDim[1]);
		this.svg.setAttribute("style", "float:left;margin-left: 5px; margin-bottom: 5px");
		wrapper.appendChild(this.svg);	
		
	    var div = document.createElement("div");
		div.setAttribute("id", "hive_inclusionTable");
		div.setAttribute("style", "width: "+ (this.inclusionTableWidth-(2*this.inclusionTablePadding)) + "px; height: "+ this.svgDim[1] + "px; overflow-y: scroll; padding: " + this.inclusionTablePadding + "px;");
		this._container.appendChild(div);
	    
		this.draw();
	},
	
	draw : function()
	{
		this.drawBackground();
		this.initDevices();
		if(this.mode == 0)
		{
			this.drawLines(this.devs[0], 0);
			this.drawLines(this.devs[1], 1);
		}
		else if(this.mode == 1)
		{
			var origin = [15, this.svgDim[1]/2];				// origin of ellipses
			var innerDim = [this.svgDim[0]/10, this.svgDim[1]/10] ;										// inner ellipse dimensions
			var outerDim = [this.svgDim[0] - 15, (this.svgDim[1]/2) - 15];	// outer ellipse dimensions
			this.drawLines2(this.devs[0], 0, origin[0], origin[1], innerDim[0], innerDim[1], outerDim[0], outerDim[1], 285, 345);
			this.drawLines2(this.devs[1], 1, origin[0], origin[1], innerDim[0], innerDim[1], outerDim[0], outerDim[1], 15, 85);
		}
		else if(this.mode == 2)
		{
			var origin = [(this.svgDim[0]/2) + 10, this.svgDim[1]/2];				// origin of ellipses
			var innerDim = [this.svgDim[0]/10, this.svgDim[1]/10] ;										// inner ellipse dimensions
			var outerDim = [this.svgDim[0]/2, (this.svgDim[1]/2) - 15];	// outer ellipse dimensions
			this.drawLines2(this.devs[0], 0, origin[0], origin[1], innerDim[0], innerDim[1], outerDim[0], outerDim[1], 195, 345);
			this.drawLines2(this.devs[1], 1, origin[0], origin[1], innerDim[0], innerDim[1], outerDim[0], outerDim[1], 15, 165);
		}
		this.drawInclusionTable();
		this.drawConnections();
		this.drawNodes();
		
	},
	
	initColorPointers : function(){
		this.pColors = [0, Math.floor(this.groupColors.length/2)];
	},
	
	setNextColor : function (ind)
	{
		this.pColors[ind]++;
		if(this.pColors[ind] >= this.groupColors.length){
			this.pColors[ind] = 0;
		}
	},
	
	keyboardHandler: function (e)
	{
		//console.log(e.keyCode);
	},
	
	get_selected_connections: function(list)
	{
		var vals =[];
		return vals;
	},
	
	/**
	 * returns an assoc containing the devices included in the signals grid
	 */
	get_focused_devices : function()
	{
		var list = new Assoc();
		return list;
	},
	
	update_display : function ()
	{
		this.init();
	},
	
	initDevices : function ()
	{
		//divide devices into sources and destinations
		var keys = this.model.devices.keys();
		for (var d in keys) 
		{
			var k = keys[d];
			var dev = this.model.devices.get(k);
			
			if (dev.n_outputs)
				this.devs[0].push(dev);
			if (dev.n_inputs)
				this.devs[1].push(dev);
		}

	},
	
	drawBackground : function ()
	{
		// draw background
		var bk = document.createElementNS(this.svgNS,"rect");
		bk.setAttribute("x", 0);
		bk.setAttribute("x", 0);
		bk.setAttribute("width", this.svgDim[0]);
		bk.setAttribute("height", this.svgDim[1]);
    	bk.setAttribute("class", "hive_svg");
    	this.svg.appendChild(bk);
		
	},
	drawInclusionTable : function ()
	{
		var _self = this;
		var table = document.getElementById("hive_inclusionTable");

		// switch mode button
		var btn = document.createElement("button");
		btn.innerHTML = "Switch Mode";
		//btn.setAttribute("style", "float: left;");
		btn.title = "switch hive plot style";
		btn.addEventListener("click", function(evt){
			_self.mode++;
			if(_self.mode == 3)
				_self.mode = 0;
			_self.update_display();
		});
		table.appendChild(btn);
		table.appendChild(document.createElement('br'));
		
		// repeat for source and destination devices
		var labels = ["Source Devices", "Destination Devices"];
		for(var ind=0; ind<2; ind++)
		{
			table.appendChild(document.createElement('br'));
			table.appendChild(document.createTextNode(labels[ind]));
			table.appendChild(document.createElement('br'));
			
			for(var i=0; i<this.devs[ind].length; i++)
			{
				var dev = this.devs[ind][i];
				var label = dev.name;
				
				var checkbox = document.createElement('input');
				checkbox.type = "checkbox";
				checkbox.name = label;
				checkbox.value = label;
				checkbox.checked = (arrIsUnique(label, this.excludedDevs[ind]));
				if(ind==0){
					checkbox.addEventListener("click", function(evt){
						_self.onInclusionTableChecked(evt, 0);
					});
				}else if(ind==1){
					checkbox.addEventListener("click", function(evt){
						_self.onInclusionTableChecked(evt, 1);
					});
				}
				
				
				var textLabel = document.createElement("p");
				textLabel.setAttribute("data-src", dev.name);
				textLabel.setAttribute("style", "display: inline");
				textLabel.appendChild(document.createTextNode(label));
				
				textLabel.addEventListener("mouseover", function(evt){
					_self.onDevMouseOver(evt.target.getAttribute("data-src"));
				});
				textLabel.addEventListener("mouseout", function(evt){
					_self.onDevMouseOut(evt.target.getAttribute("data-src"));
				});
				
				table.appendChild(checkbox);
				table.appendChild(textLabel);
				table.appendChild(document.createElement('br'));
			}
		}
	},
	
	onInclusionTableChecked : function(e, ind)
	{
		var item = e.target;
		var devName = item.value;
		
		// include
		if(item.checked)
		{
			var index = this.excludedDevs[ind].indexOf(devName);
			if(index >= 0)
				this.excludedDevs[ind].splice(index, 1);
		}
		// exclude 
		else
		{
			arrPushIfUnique(devName, this.excludedDevs[ind]);
		}
		
		this.update_display();
	},
	
	drawLines : function (srcData, ind)
	{
		var _self = this;
		
		// origin of ellipses
		var originX = 145;
		var originY = this.svgDim[1]/2 + 50;
		
		// inner radius ellipse
		var w1 = this.svgDim[0]/14;	// width of ellipse
		var h1 = this.svgDim[1]/16;	// height of ellipse
		
		// outer radius ellipse
		var w2 = (this.svgDim[0]) - 15;	// width of ellipse
		var h2 = (this.svgDim[1]/2) - 15;	// height of ellipse
		
		var angles = [270 * Math.PI / 180 , 40 * Math.PI / 180];
		
		// draw axis
		var x1 = ( w1 * Math.cos(angles[ind]) ) + (originX);
		var y1 = ( h1 * Math.sin(angles[ind]) ) + (originY);
		var x2 = ( w2 * Math.cos(angles[ind]) ) + originX;
		var y2 = ( h2 * Math.sin(angles[ind]) ) + originY;
		
		var line = document.createElementNS(this.svgNS,"path");
		var pathDefn = "M " + x1 + " " + y1 + " L " + x2 + " " + y2; 
		line.setAttribute("d", pathDefn);
		line.setAttribute("class", (ind==0) ? "hive_axis_SRC" : "hive_axis_DST");
		this.svg.appendChild(line);
		
		// get signals
		var sigsArray = new Array();
		var nTotalSigs = 0;
		var nTotalDevs = srcData.length;
		for (var i=0; i<nTotalDevs; i++)
		{
//			var dev = this.model.devices.get(srcData[i]);
			var dev = srcData[i];
			$(this._container).trigger("getSignalsByDevice", dev.name);
			
			// get signals from model	
			var sigs = new Array();
			var keys = this.model.signals.keys();
		    for (var s in keys) 
		    {
		        var k = keys[s];
		        var sig = this.model.signals.get(k);
				if(sig.device_name == dev.name){
					sigs.push(sig);
					nTotalSigs++;
				}
					
		    }
		    sigsArray.push(sigs);
		}
		
		// draw signals grouped by device
		var l = line.getTotalLength();
		var axisPadding = 10;
		var nodeGroupPadding = 10;
//		var nodePadding = (l - (nodeGroupPadding*(nTotalDevs-1)) - (2*axisPadding)) / nTotalSigs;
		var nodePadding = 5;
		
		var d = axisPadding;
		for (var i=0; i<sigsArray.length; i++)
		{
			var signals = sigsArray[i];
			
			for (var j=0; j<signals.length; j++)
			{
				var sig = signals[j];
		    	
		    	var pt = line.getPointAtLength(d);
		    	var node = document.createElementNS(this.svgNS,"circle");
		    	node.setAttribute("data-src", dev.name);
		    	node.setAttribute("data-srcSignal", sig.name);
		    	node.setAttribute("cx", pt.x);
		    	node.setAttribute("cy", pt.y);
		    	node.setAttribute("r", 5);
		    	
		    	// check if node is in the EXCLUSION list
		    	if(arrIsUnique(sig.device_name, this.excludedDevs[ind]))
		    		node.setAttribute("class", "Node");
		    	else
		    		node.setAttribute("class", "Node_hidden");
		    	
		    	// mouse over event handlers
				node.addEventListener("mouseover", function(evt){
					_self.onNodeMouseOver(evt);
				});
				node.addEventListener("mouseout", function(evt){
					_self.onNodeMouseOut(evt);
				});
		    	
		    	
				this.sigs[ind].push(sig);
				this.nodes[ind].push(node);
				node.setAttribute("style", "fill: " + this.groupColors[this.pColors[ind]] );
				node.setAttribute("data-src", sig.device_name);

				d += nodePadding;
		    	
			}
			d += nodeGroupPadding;

			this.setNextColor(ind);
			
			
		}
	},
	
	drawLines2 : function (srcData, ind, originX, originY, w1, h1, w2, h2, angle1, angle2)
	{
		var _self = this;
		
		var angleFrom = angle1 * Math.PI / 180;		
		var angleTo = angle2 * Math.PI / 180;		
		var range = Math.abs(angle2 - angle1) * Math.PI / 180;

		// for each device
		var n = srcData.length;
		var angleInc = (n==1)? Math.PI/4 : range/(n-1);
		for (var i=0; i<n; i++)
		{
			var dev = srcData[i];
			
			var nAngle = angleFrom + (i*angleInc);
			var x1 = ( w1 * Math.cos(nAngle) ) + originX;
			var y1 = ( h1 * Math.sin(nAngle) ) + originY;
			var x2 = ( w2 * Math.cos(nAngle) ) + originX;
			var y2 = ( h2 * Math.sin(nAngle) ) + originY;

			var line = document.createElementNS(this.svgNS,"path");
			line.setAttribute("data-src", dev.name);
			
			var pathDefn = "M " + x1 + " " + y1 + " L " + x2 + " " + y2; 
			line.setAttribute("d", pathDefn);
			line.setAttribute("class", (ind==0) ? "hive_axis_SRC" : "hive_axis_DST");
			line.setAttribute("data-src", dev.name);
			line.addEventListener("mouseover", function(evt){
				_self.onDevMouseOver(evt.target.getAttribute("data-src"));
			});
			line.addEventListener("mouseout", function(evt){
				_self.onDevMouseOut(evt.target.getAttribute("data-src"));
			});

			this.svg.appendChild(line);
			
			
			// get signals from model	
			$(this._container).trigger("getSignalsByDevice", dev.name);
			var sigs = [];
			var keys = this.model.signals.keys();
		    for (var s in keys) {
		        var k = keys[s];
		        var sig = this.model.signals.get(k);

				if(sig.device_name == dev.name){
					sigs.push(sig);
				}
					
		    }
		    
		    var padding = 30;
		    var m = sigs.length;
		    var lineLen = (line.getTotalLength() - (2*padding));
		    var lineInc = lineLen / (m-1);
		    if(m==1) 
		    	lineInc = 0;	// handle divide by zero when there's only 1 signal
		    for (var j=0; j<m; j++)
			{
		    	var sig = sigs[j];
		    	var pt = line.getPointAtLength( (j*lineInc) + padding);
		    	var node = document.createElementNS(this.svgNS,"circle");
		    	node.setAttribute("data-src", dev.name);
		    	node.setAttribute("data-srcSignal", sig.name);
		    	node.setAttribute("cx", pt.x);
		    	node.setAttribute("cy", pt.y);
		    	node.setAttribute("r", 5);
		    	node.setAttribute("style", "fill: " + this.groupColors[this.pColors[ind]] );
		    	
		    	if(arrIsUnique(sig.device_name, this.excludedDevs[ind]))
		    		node.setAttribute("class", "Node");
		    	else
		    		node.setAttribute("class", "Node_hidden");
		    	
		    	node.addEventListener("mouseover", function(evt){
					_self.onNodeMouseOver(evt);
				});
				node.addEventListener("mouseout", function(evt){
					_self.onNodeMouseOut(evt);
				});
		    	
				this.sigs[ind].push(sig);
				this.nodes[ind].push(node);
			}
		    
		    this.setNextColor(ind);
		}
	},
	
	drawConnections : function()
	{
		for(var i=0; i<this.sigs[0].length; i++)
		{
			for(var j=0; j<this.sigs[1].length; j++)
			{
				var s = this.sigs[0][i];
				var d = this.sigs[1][j];
				
				var src = s.device_name + s.name;
				var dst = d.device_name + d.name;
				if(this.model.isConnected(src, dst))
				{
					var node1 = this.nodes[0][i];
					var node2 = this.nodes[1][j];
					
					var x1 = node1.getAttribute("cx");
					var y1 = node1.getAttribute("cy");
					var x2 = node2.getAttribute("cx");
					var y2 = node2.getAttribute("cy");
					
					var ctX1 =  parseInt(x2) - 20;
					var ctY1 = parseInt(y1) + 20;
					
					var ctX2 = x2;
					var ctY2 = y2;
					
					var line = document.createElementNS(this.svgNS,"path");
					line.setAttribute("data-src", s.device_name);
					line.setAttribute("data-dst", d.device_name);
					line.setAttribute("data-srcSignal", s.name);
					line.setAttribute("data-dstSignal", d.name);
//					line.setAttribute("d", "M " + x1 + " " + y1 + " L " + x2 + " " + y2);
					line.setAttribute("d", "M " + x1 + " " + y1 + " Q " + ctX1 + " " + ctY1 + " " + x2 + " " + y2);
					if( arrIsUnique(s.device_name, this.excludedDevs[0]) && arrIsUnique(d.device_name, this.excludedDevs[1]))
						line.setAttribute("class", "hive_connection");
					else
						line.setAttribute("class", "hive_connection_hidden");
					
					line.addEventListener("mouseover", function(evt){
						this.setAttribute("class", "hive_connection_over");
					});
					line.addEventListener("mouseout", function(evt){
						this.setAttribute("class", "hive_connection");
					});
					
					this.connectionsLines.push(line);
					this.svg.appendChild(line);
				}
			}
		}
	},
	
	/*
	 * done at end so z-index is above all other graphics
	 */
	drawNodes : function()
	{
		for(var i=0; i< this.nodes[0].length; i++){
			this.svg.appendChild(this.nodes[0][i]);
		}
		for(var i=0; i< this.nodes[1].length; i++){
			this.svg.appendChild(this.nodes[1][i]);
		}
	},
	
	onDevMouseOver : function(devName)
	{
		for (var i=0; i<this.connectionsLines.length; i++)
		{
			var con = this.connectionsLines[i];
			if(con.getAttribute("data-src") == devName ||  con.getAttribute("data-dst") == devName )
			{
				con.setAttribute("class", "hive_connection_over");
			}
		}
	},
	onDevMouseOut : function(devName){
		for (var i=0; i<this.connectionsLines.length; i++)
		{
			var con = this.connectionsLines[i];
			if(con.getAttribute("data-src") == devName || con.getAttribute("data-dst") == devName ){
				if(arrIsUnique(devName, this.excludedDevs[0]) && arrIsUnique(devName, this.excludedDevs[1]) )
					con.setAttribute("class", "hive_connection");
				else
					con.setAttribute("class", "hive_connection_hidden");
			}
		}
	},
	
	onNodeMouseOver : function(e)
	{
		var node = e.target;
		for (var i=0; i<this.connectionsLines.length; i++)
		{
			var con = this.connectionsLines[i];
			if( (con.getAttribute("data-src") == node.getAttribute("data-src") && 
					con.getAttribute("data-srcSignal") == node.getAttribute("data-srcSignal"))
					||
					(con.getAttribute("data-dst") == node.getAttribute("data-src") && 
							con.getAttribute("data-dstSignal") == node.getAttribute("data-srcSignal"))
			  )
			{
				con.setAttribute("class", "hive_connection_over");
			}
		}
	},
	onNodeMouseOut : function(e){
		var line = e.target;
		for (var i=0; i<this.connectionsLines.length; i++)
		{
			var con = this.connectionsLines[i];
			if(arrIsUnique(con.getAttribute("data-src"), this.excludedDevs[0]))
				con.setAttribute("class", "hive_connection");
			else
				con.setAttribute("class", "hive_connection_hidden");
		}
	},
	
	
	on_resize : function ()
	{
		var w = $(this._container).width() - 10;
		var h = $(this._container).height() - 10;
		this.svgDim = [w - this.inclusionTableWidth - (2*this.inclusionTablePadding), h];
		this.init();
	},
	
	cleanup : function ()
	{
	}
};

function HiveViewPreset(name, includedSrcs, includedDsts)
{
	this.name = name;
	this.excludedDevs[0] = includedSrcs;
	this.excludedDevs[1] = includedDsts;
};



function arrPushIfUnique(item, arr){
	if(arrIsUnique(item, arr))
		arr.push(item);
}

function arrIsUnique(item, arr){
	for(var i=0; i<arr.length; i++){
		if(arr[i] == item)
			return false;
	}	
	return true;
}

