//+++++++++++++++++++++++++++++++++++++++++++ //
//		  	     Grid View Class		  	  //		 
//+++++++++++++++++++++++++++++++++++++++++++ //

function HivePlotView(container, model)
{
	var _self = this;
	this._container = container;
	this.model = model;
	this.includedSrcs = [];
	this.includedDsts = [];
	this.srcSigs = [];
	this.dstSigs = [];
	this.srcNodes = [];
	this.dstNodes = [];
	this.svgNS = "http://www.w3.org/2000/svg";
	this.svgNSxlink = "http://www.w3.org/1999/xlink";
	this.svg;					// holding <SVG> elements for easy reference
	this.svgDim = [800, 600]; 	// x-y dimensions of the svg canvas

	//this.init();

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
		
		this.srcSigs = [];
		this.dstSigs = [];
		
		$(this._container).empty();
		
//		$(this._container).css("min-width", "880px");
//		$(this._container).css("min-height", "580px");
//		
		var wrapper = document.createElement("div");
		this._container.appendChild(wrapper);
		
		this.svg = document.createElementNS(this.svgNS,"svg");
		this.svg.setAttribute("id", "HivePlotSVG");
		this.svg.setAttribute("xmlns", this.svgNS);
		this.svg.setAttribute("xmlns:xlink", this.svgNSxlink);
		this.svg.setAttribute("width", this.svgDim[0]);
		this.svg.setAttribute("height", this.svgDim[1]);
//		this.svg.setAttribute("preserveAspectRatio", "none");
		this.svg.setAttribute("style", "float:left;margin-left: 5px; margin-bottom: 5px");
		wrapper.appendChild(this.svg);	
	
		this.draw();
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
		//divide devices into sources and destinations
		var srcDevs = new Array();
		var dstDevs = new Array();
		
		var keys = this.model.devices.keys();
		for (var d in keys) 
		{
			var k = keys[d];
			var dev = this.model.devices.get(k);
			
			if (dev.n_outputs)
				srcDevs.push(dev);
			if (dev.n_inputs)
				dstDevs.push(dev);
		}
		
		
		this.drawLines(srcDevs, true);
		this.drawLines(dstDevs, false);
		this.drawConnections();
	},
	
	drawLines : function (srcData, isSources)
	{
		var originX = this.svgDim[0]/2;
		var originY = this.svgDim[1]/2;
		var rangeLimiter = 30 * Math.PI / 180;	// degrees to radians

		// SRC Devices
		var n = srcData.length;
		var range = Math.PI - (2*rangeLimiter);	// x2 or each end
		var angleInc = range / (n-1);
		if(n==1)
			angleInc = Math.PI/4;
		for (var i=0; i<n; i++)
		{
			
			// inner radius ellipse
			var w1 = this.svgDim[0]/10;	// width of ellipse
			var h1 = this.svgDim[1]/10;	// height of ellipse
			var x1 = ( w1 * Math.cos((i*angleInc) + (rangeLimiter) ) ) + (originX);
			var y1 = ( h1 * Math.sin((i*angleInc) + (rangeLimiter) ) ) + (originY);
			if(isSources)
				y1 = this.svgDim[1] - y1;
			
			// outer radius ellipse
			var w2 = (this.svgDim[0]/2) - 15;	// width of ellipse
			var h2 = (this.svgDim[1]/2) - 15;	// height of ellipse
			var x2 = ( w2 * Math.cos((i*angleInc) + (rangeLimiter) ) ) + originX;
			var y2 = ( h2 * Math.sin((i*angleInc) + (rangeLimiter) ) ) + originY;
			if(isSources)
				y2 = this.svgDim[1] - y2;
			
			var dev = srcData[i];
			var line = document.createElementNS(this.svgNS,"path");
			line.setAttribute("data-src", dev.name);
			
			var pathDefn = "M " + x1 + " " + y1 + " L " + x2 + " " + y2; 
			line.setAttribute("d", pathDefn);
			line.setAttribute("class", (isSources) ? "Line_SRC" : "Line_DST");
			this.svg.appendChild(line);
			
			// its signals
			$(this._container).trigger("getSignalsByDevice", dev.name);
			
			
			// get signals from model	
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
		    	node.setAttribute("cx", pt.x);
		    	node.setAttribute("cy", pt.y);
		    	node.setAttribute("r", 5);
		    	node.setAttribute("class", (isSources) ? "Node_SRC" : "Node_DST");
		    	this.svg.appendChild(node);
				
		    	if(isSources){
					this.srcSigs.push(sig);
					this.srcNodes.push(node);
				}
				else{
					this.dstSigs.push(sig);
					this.dstNodes.push(node);
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
					
					var line = document.createElementNS(this.svgNS,"path");
					line.setAttribute("d", "M " + x1 + " " + y1 + " L " + x2 + " " + y2);
					line.setAttribute("class", "hiveLine_connected");
					this.svg.appendChild(line);
				}
			}
		}
	},
	
	updateSignalsGrid : function()
	{
	
	    
	    // add connections
		
		var c = this.model.connections.keys();
		for (var i=0; i<c.length; i++)			
		{
			var con = this.model.connections.get(c[i]);
			var src = this.model.connections.get(c[i]).src_name;
			var dst = this.model.connections.get(c[i]).dest_name;
			connections.push([src,dst]);
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

function GridViewPreset(name, includedSrcs, includedDsts)
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

