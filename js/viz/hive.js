//+++++++++++++++++++++++++++++++++++++++++++ //
//		  	     Hive View Class		  	  //		 
//+++++++++++++++++++++++++++++++++++++++++++ //

function HivePlotView(container, model)
{
	var _self = this;
	this._container = container;
	this.model = model;
	var srcDevs = [];
	var dstDevs = [];
	this.includedSrcs = [];
	this.includedDsts = [];
	this.srcSigs = [];
	this.dstSigs = [];
	this.srcNodes = [];
	this.dstNodes = [];
	this.connectionsLines = [];
	this.svgNS = "http://www.w3.org/2000/svg";
	this.svgNSxlink = "http://www.w3.org/1999/xlink";
	this.svg;					// holding <SVG> elements for easy reference
	this.svgDim = [800, 600]; 	// x-y dimensions of the svg canvas
	this.inclusionTableWidth = 210;
	this.inclusionTablePadding = 8;

	this.groupColors = ["Cyan", "Orange", "Yellow", "Red", "DodgerBlue", "PeachPuff", "BlanchedAlmond", "DarkViolet", "PaleGreen", "Silver", "AntiqueWhite", "LightSteelBlue" ];
	this.initColorPointers();
	
	//Keyboard handlers
	document.onkeyup = function(e){
		_self.keyboardHandler(e);
	};
	/**
	 * Disables my keyboard shortcuts from moving the browser's scroll bar 
	 http://stackoverflow.com/questions/2020414/how-to-disable-page-scrolling-in-ff-with-arrow-keys
	 */
	/*
	document.onkeydown = function(e) {
	    var k = e.keyCode;
	    if((k >= 37 && k <= 40) || k == 32) {
	        return false;
	    }
	};
	*/
		
}

HivePlotView.prototype = {
	
	init : function () 
	{ 
		var _self = this;	// to pass to the instance of LibMApperMatrixView to event handlers
		var div, btn;		// to instantiate items
		
		this.srcDevs = [];
		this.dstDevs = [];
		this.srcSigs = [];
		this.dstSigs = [];
		this.srcNodes = [];
		this.dstNodes = [];
		this.connectionsLines = [];
		
		$(this._container).empty();
		this.initColorPointers();
		
//		$(this._container).css("min-width", "880px");
//		$(this._container).css("min-height", "580px");
//		
		var wrapper = document.createElement("div");
		this._container.appendChild(wrapper);
		
		this.svg = document.createElementNS(this.svgNS,"svg");
		this.svg.setAttribute("id", "HivePlotSVG");
		this.svg.setAttribute("xmlns", this.svgNS);
		this.svg.setAttribute("xmlns:xlink", this.svgNSxlink);
		this.svg.setAttribute("width", this.svgDim[0] - this.inclusionTableWidth);
		this.svg.setAttribute("height", this.svgDim[1]);
//		this.svg.setAttribute("preserveAspectRatio", "none");
		this.svg.setAttribute("style", "float:left;margin-left: 5px; margin-bottom: 5px");
		wrapper.appendChild(this.svg);	
		
		
		// bk gradient
		var defs = document.createElementNS(this.svgNS, "defs");
		var linearGradient, stop;
	    linearGradient = document.createElementNS(this.svgNS, "linearGradient");
	    linearGradient.setAttribute('id', "bkGradient");
	    linearGradient.setAttribute('x1', '0%');
	    linearGradient.setAttribute('y1', '0%');
	    linearGradient.setAttribute('x2', '0%');
	    linearGradient.setAttribute('y2', '100%');
	    defs.appendChild(linearGradient);
	    stop = document.createElementNS(this.svgNS, 'stop');
	    stop.setAttribute('offset', '0%');
	    stop.setAttribute('class', 'bkTop');
	    linearGradient.appendChild(stop);
	    stop = document.createElementNS(this.svgNS, 'stop');
	    stop.setAttribute('offset', '50%');
	    stop.setAttribute('class', 'bkTop');
	    linearGradient.appendChild(stop);
	    stop = document.createElementNS(this.svgNS, 'stop');
	    stop.setAttribute('offset', '50%');
	    stop.setAttribute('class', 'bkBot');
	    linearGradient.appendChild(stop);
	    stop = document.createElementNS(this.svgNS, 'stop');
	    stop.setAttribute('offset', '100%');
	    stop.setAttribute('class', 'bkBot');
	    linearGradient.appendChild(stop);
	    this.svg.appendChild(linearGradient);
	
	    var div = document.createElement("div");
		div.setAttribute("id", "hive_inclusionTable");
		div.setAttribute("style", "width: "+ (this.inclusionTableWidth-(2*this.inclusionTablePadding)) + "px; height: "+ this.svgDim[1] + "px; overflow-y: scroll; padding: " + this.inclusionTablePadding + "px;");
		this._container.appendChild(div);
	    
	    
		this.draw();
	},
	
	initColorPointers : function ()
	{
		this.nColor1 = 0;
		this.nColor2 = this.groupColors.length -1;
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
	
	draw : function()
	{
				
		// draw background
		var bk = document.createElementNS(this.svgNS,"rect");
		bk.setAttribute("x", 0);
		bk.setAttribute("x", 0);
		bk.setAttribute("width", this.svgDim[0]);
		bk.setAttribute("height", this.svgDim[1]);
    	bk.setAttribute("class", "hive_svg");
    	this.svg.appendChild(bk);
		
		//divide devices into sources and destinations
		var keys = this.model.devices.keys();
		for (var d in keys) 
		{
			var k = keys[d];
			var dev = this.model.devices.get(k);
			
			if (dev.n_outputs)
			{
				this.srcDevs.push(dev);
//				this.includedSrcs.push(dev.name);
			}
			if (dev.n_inputs)
			{
				this.dstDevs.push(dev);
//				this.includedDsts.push(dev.name);
			}
		}
		
		this.drawLines(this.srcDevs, true);
		this.drawLines(this.dstDevs, false);

		this.drawInclusionTable();
		
		this.drawConnections();
		this.drawNodes();
	},

	drawInclusionTable : function ()
	{
		var _self = this;
		var table = document.getElementById("hive_inclusionTable");
		
		for(var i=0; i<this.srcDevs.length; i++)
		{
			var dev = this.srcDevs[i];
			var label = dev.name;

			var checkbox = document.createElement('input');
			checkbox.type = "checkbox";
			checkbox.name = label;
			checkbox.value = label;
			checkbox.checked = (arrIsUnique(label, this.includedSrcs));
			//checkbox.Attributes.Add("onclick", "enableField();");
			checkbox.addEventListener("click", function(evt){
				_self.onInclusionTableChecked(evt);
			});
			
			table.appendChild(checkbox);
			table.appendChild(document.createTextNode(label));
			table.appendChild(document.createElement('br'));
		}
	},
	
	onInclusionTableChecked : function(e)
	{
		var item = e.target;
		var devName = item.value;
		// add include
		if(item.checked)
		{
			var ind = this.includedSrcs.indexOf(devName);
			if(ind >= 0)
				this.includedSrcs.splice(ind, 1);
		}
		// exclude 
		else
		{
			arrPushIfUnique(devName, this.includedSrcs);
		}
		
		this.update_display();
	},
	
	drawLines : function (srcData, isSources)
	{
		var _self = this;
		
		// origin of ellipses
		var heightOffset = 50;
		var originX = 145;
		var originY = this.svgDim[1]/2 + heightOffset;
		
		// inner radius ellipse
		var w1 = this.svgDim[0]/14;	// width of ellipse
		var h1 = this.svgDim[1]/16;	// height of ellipse
		
		// outer radius ellipse
		var w2 = (this.svgDim[0]) - 15;	// width of ellipse
		var h2 = (this.svgDim[1]/2) - 15;	// height of ellipse
		
		var angleSrcs = 270 * Math.PI / 180;		// offset from zero
		var angleDsts = 40 * Math.PI / 180;		// offset from 180
		
		// draw axis
		var angle = (isSources) ? angleSrcs : angleDsts;
		var x1 = ( w1 * Math.cos(angle) ) + (originX);
		var y1 = ( h1 * Math.sin(angle) ) + (originY);
		var x2 = ( w2 * Math.cos(angle) ) + originX;
		var y2 = ( h2 * Math.sin(angle) ) + originY - heightOffset;
		
		var line = document.createElementNS(this.svgNS,"path");
		var pathDefn = "M " + x1 + " " + y1 + " L " + x2 + " " + y2; 
		line.setAttribute("d", pathDefn);
		line.setAttribute("class", (isSources) ? "hive_axis_SRC" : "hive_axis_DST");
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
		    	node.setAttribute("cx", pt.x);
		    	node.setAttribute("cy", pt.y);
		    	node.setAttribute("r", 5);
		    	
		    	if(arrIsUnique(sig.device_name, this.includedSrcs))
		    		node.setAttribute("class", "Node");
		    	else
		    		node.setAttribute("class", "Node_hidden");
		    	
		    	
		    	node.setAttribute("data-src", dev.name);
				node.addEventListener("mouseover", function(evt){
					_self.onNodeMouseOver(evt);
				});
				node.addEventListener("mouseout", function(evt){
					_self.onNodeMouseOut(evt);
				});
		    	
		    	
		    	if(isSources){
					this.srcSigs.push(sig);
					this.srcNodes.push(node);
					node.setAttribute("style", "fill: " + this.groupColors[this.nColor1] );
					node.setAttribute("data-src", sig.device_name);
				}
				else{
					this.dstSigs.push(sig);
					this.dstNodes.push(node);
					node.setAttribute("style", "fill: " + this.groupColors[this.nColor2] );
					node.setAttribute("data-dst", sig.device_name);
				}
		    	d += nodePadding;
		    	
			}
			d += nodeGroupPadding;

			if(isSources){
				this.nColor1++;
				if(this.nColor1 >= this.groupColors.length){
					this.nColor1 = 0;
				}
			}
			else{
				this.nColor2--;
				if(this.nColor2 < 0){
					this.nColor2 =  this.groupColors.length -1;
				}
			}
			
			
		}
	},
	
	drawConnections : function()
	{
		for(var i=0; i<this.srcSigs.length; i++)
		{
			for(var j=0; j<this.dstSigs.length; j++)
			{
				var s = this.srcSigs[i];
				var d = this.dstSigs[j];
				
				var src = s.device_name + s.name;
				var dst = d.device_name + d.name;
				if(this.model.isConnected(src, dst))
				{
					
					var node1 = this.srcNodes[i];
					var node2 = this.dstNodes[j];
					
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
//					line.setAttribute("d", "M " + x1 + " " + y1 + " L " + x2 + " " + y2);
					line.setAttribute("d", "M " + x1 + " " + y1 + " Q " + ctX1 + " " + ctY1 + " " + x2 + " " + y2);
					if(arrIsUnique(s.device_name, this.includedSrcs))
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
		for(var i=0; i< this.srcNodes.length; i++){
			this.svg.appendChild(this.srcNodes[i]);
		}
		for(var i=0; i< this.dstNodes.length; i++){
			this.svg.appendChild(this.dstNodes[i]);
		}
	},
	
	onLineMouseOver : function(e)
	{
		var line = e.target;
		for (var i=0; i<this.connectionsLines.length; i++)
		{
			var con = this.connectionsLines[i];
			if(con.getAttribute("data-src") == line.getAttribute("data-src"))
			{
				con.setAttribute("class", "hive_connection_over");
			}
		}
	},
	onLineMouseOut : function(e){
		var line = e.target;
		for (var i=0; i<this.connectionsLines.length; i++)
		{
			var con = this.connectionsLines[i];
			if(con.getAttribute("data-src") == line.getAttribute("data-src"))
				con.setAttribute("class", "hive_connection");
		}
	},
	
	onNodeMouseOver : function(e)
	{
		var node = e.target;
		var type;
		if(node.hasAttribute("data-src"))
			type = 1;
		else
			type = 0;
		
		for (var i=0; i<this.connectionsLines.length; i++)
		{
			var con = this.connectionsLines[i];
			if(type == 1 && con.getAttribute("data-src") == node.getAttribute("data-src"))
					con.setAttribute("class", "hive_connection_over");
			else{
				if(con.getAttribute("data-dst") == node.getAttribute("data-dst"))
					con.setAttribute("class", "hive_connection_over");
			}
		}
	},
	onNodeMouseOut : function(e){
		var line = e.target;
		for (var i=0; i<this.connectionsLines.length; i++)
		{
			var con = this.connectionsLines[i];
			if(arrIsUnique(con.getAttribute("data-src"), this.includedSrcs))
				con.setAttribute("class", "hive_connection");
			else
				con.setAttribute("class", "hive_connection_hidden");
		}
	},
	
	on_resize : function ()
	{
		var w = $(this._container).width() - 10;
		var h = $(this._container).height() - 10;
		this.svgDim = [w, h];
		this.init();
	},
	
	cleanup : function ()
	{
	}
	
};

function HiveViewPreset(name, includedSrcs, includedDsts)
{
	this.name = name;
	this.includedSrcs = includedSrcs;
	this.includedDsts = includedDsts;
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

