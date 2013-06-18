//+++++++++++++++++++++++++++++++++++++++++++ //
//		  	     Grid View Class		  	  //		 
//+++++++++++++++++++++++++++++++++++++++++++ //

function GridView(container, model)
{
	var _self = this;
	this._container = container;
	this.model = model;

	this.activeGridIndex = 0;
	this.devGrid;
	this.sigGrid;
	
	this.viewMode = 3;
	
	this.includedSrcs = new Array();
	this.includedDsts = new Array();
	
	this.init();

	//Keyboard handlers
	document.onkeyup = function(e){
		_self.keyboardHandler(e, _self);
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

GridView.prototype = {
		
	init : function () 
	{ 
		var _self = this;	// to pass to the instance of LibMApperMatrixView to event handlers
		var div, btn;		// to instantiate items
		
		$(this._container).empty();
		
		$(this._container).css("min-width", "880px");
		$(this._container).css("min-height", "580px");
		
		var wrapper = document.createElement("div");
		wrapper.setAttribute("id", "gridWrapper");
		this._container.appendChild(wrapper);
		
		// button bar
		div = document.createElement("div");
		div.setAttribute("id", "actionBar");
		div.setAttribute("style", "margin-bottom: 5px; margin-left: 16px;");
		
		// add device button
		btn = document.createElement("button");
		btn.innerHTML = "ADD";
		btn.addEventListener("click", function(evt){
			_self.includeSelectedDevices(_self);
		});
		div.appendChild(btn);
			
		//remove device button
		btn = document.createElement("button");
		btn.innerHTML = "REM";
		btn.addEventListener("click", function(evt){
			_self.excludeSelectedDevices(_self);
		});
		div.appendChild(btn);

		// View Buttons
		btn = document.createElement("button");
		btn.innerHTML = "Devices View";
		btn.addEventListener("click", function(evt){
			_self.switchView(1);
		});
		div.appendChild(btn);
		
		btn = document.createElement("button");
		btn.innerHTML = "Signals View";
		btn.addEventListener("click", function(evt){
			_self.switchView(2);
		});
		div.appendChild(btn);
		btn = document.createElement("button");
		btn.innerHTML = "Split View";
		btn.addEventListener("click", function(evt){
			_self.switchView(3);
		});
		div.appendChild(btn);
		wrapper.appendChild(div);
		// END button bar
		
		// devices Grid (gridIndex=0)
		div = document.createElement("div");
		div.setAttribute("id", "devGrid");
		wrapper.appendChild(div);
		
		// Signals Grid (gridIndex=1)
		div = document.createElement("div");
		div.setAttribute("id", "sigGrid");
		wrapper.appendChild(div);
		
		this.calculateSizes();	// to set width/height of divs before initializing the grids
		
		this.devGrid = new SvgGrid(document.getElementById("devGrid"), this.model, 0);
		this.sigGrid = new SvgGrid(document.getElementById("sigGrid"), this.model, 1);
		
		$("#devGrid").on("connect", function(e, cell){
			e.stopPropagation();	//prevents bubbling to main.js
			_self.link(e, cell);
		});
		$("#devGrid").on("disconnect", function(e, cell){
			e.stopPropagation();	//prevents bubbling to main.js
			_self.unlink(e, cell);
		});
		$("#devGrid").on("toggleConnection", function(e, cell){
			e.stopPropagation();	//prevents bubbling to main.js
			_self.toggleLink(e, cell);
		});

		
		$("#sigGrid").on("connect", function(e, cell){
			e.stopPropagation();	//prevents bubbling to main.js
			_self.connect(e, cell);
		});
		$("#sigGrid").on("disconnect", function(e, cell){
			e.stopPropagation();	//prevents bubbling to main.js
			_self.disconnect(e, cell);
		});
		$("#sigGrid").on("toggleConnection", function(e, cell){
			e.stopPropagation();	//prevents bubbling to main.js
			_self.toggleConnection(e, cell);
		});

		
		$("#devGrid").on("updateConnectionProperties", function(e){
			e.stopPropagation();	//prevents bubbling to main.js
			// only sig grid needs this function
		});
		$("#sigGrid").on("updateConnectionProperties", function(e){
			e.stopPropagation();	//prevents bubbling to main.js
			update_connection_properties();
		});
		
		
		$("#devGrid").on("makeActiveGrid", function(e, gridIndex){
			e.stopPropagation();	//prevents bubbling to main.js
			_self.setActiveGrid(gridIndex);
		});
		$("#sigGrid").on("makeActiveGrid", function(e, gridIndex){
			e.stopPropagation();	//prevents bubbling to main.js
			_self.setActiveGrid(gridIndex);
		});
		
	},
	
	switchView : function(mode)
	{
		if(mode == this.viewMode)
			return;
		
		var len = 200;		// length of the animation in ms
		this.viewMode = mode;

		this.on_resize();
		
		switch (mode) 
		{
		case 1:
			$('#devGrid').show();
			$('#sigGrid').hide();
			break;
		case 2:
			$('#devGrid').hide();
			$('#sigGrid').show();
			break;
		case 3:
			$('#devGrid').show();
			$('#sigGrid').show();
			break;
		}
	},
	
	setActiveGrid : function(gridIndex){
		this.activeGridIndex = gridIndex;
	},
	
	connect : function (e, cell)
	{
		var src = cell.getAttribute("data-src");
		var dst = cell.getAttribute("data-dst");
		if(this.model.isConnected(src, dst) == false)
		{
			var srcDev = cell.getAttribute("data-src_device_name");
			var dstDev = cell.getAttribute("data-dst_device_name");
			if(this.model.isLinked(srcDev, dstDev) == false)				// devices must be linked before a connection can be made
					$(this._container).trigger("link", [srcDev, dstDev]);	// trigger link event
			$(this._container).trigger("connect", [src, dst]);	// trigger connect event
		}
	},
	disconnect : function (e, cell)
	{
		var src = cell.getAttribute("data-src");
		var dst = cell.getAttribute("data-dst");
		if(this.model.isConnected(src, dst) == true)
			$(this._container).trigger("disconnect", [src, dst]);	// trigger disconnect event
	},
	link : function (e, cell)
	{
		var src = cell.getAttribute("data-src");
		var dst = cell.getAttribute("data-dst");
		if(this.model.isLinked(src, dst) == false)
			$(this._container).trigger("link", [src, dst]);	// trigger connect event
	},
	unlink : function (e, cell)
	{
		var src = cell.getAttribute("data-src");
		var dst = cell.getAttribute("data-dst");
		if(this.model.isLinked(src, dst) == true)
			$(this._container).trigger("unlink", [src, dst]);	// trigger disconnect event
	},
	
	toggleLink : function (e, cell)
	{
		var src = cell.getAttribute("data-src");
		var dst = cell.getAttribute("data-dst");
		
		// toggle the connection
		if(this.model.isLinked(src, dst)) // already connected, so disconnect
			$(this._container).trigger("unlink", [src, dst]);	// trigger connect event
		else	// is already a connection, so remove it
			$(this._container).trigger("link", [src, dst]);	// trigger connect event
	},
	
	toggleConnection : function (e, cell)
	{
		var src = cell.getAttribute("data-src");
		var dst = cell.getAttribute("data-dst");
		
		// toggle the connection
		if(this.model.isConnected(src, dst)) // already connected, so disconnect
			$(this._container).trigger("disconnect", [src, dst]);	// trigger connect event
		else	// is already a connection, so remove it
			$(this._container).trigger("connect", [src, dst]);	// trigger connect event
	},
	
	
	keyboardHandler: function (e, _self)
	{
		if(this.activeGridIndex == 0)
			this.devGrid.keyboardHandler(e);
		else if(this.activeGridIndex == 1)
			this.sigGrid.keyboardHandler(e);
			
	},
	
	get_selected_connections: function(list)
	{
		
		var vals =[];
		
		var selectedCells = this.sigGrid.getSelectedCells();

		for (var i=0; i<selectedCells.length; i++)
		{
			var cell = selectedCells[i];
			var src = cell.getAttribute("data-src");
			var dst = cell.getAttribute("data-dst");
			if(this.model.isConnected(src, dst))
				vals.push(this.model.getConnection(src, dst));
		}	
		return vals;
	},
	
	/**
	 * returns an assoc containing the devices included in the signals grid
	 */
	get_focused_devices : function()
	{
		var list = new Assoc();
		for (var i=0; i<this.includedSrcs.length; i++)
		{
			var key = this.includedSrcs[i];
			var val = this.model.devices.get(key);
			list.add(key, val);
		}
		for (var i=0; i<this.includedDsts.length; i++)
		{
			var key = this.includedDsts[i];
			var val = this.model.devices.get(key);
			list.add(key, val);
		}
		return list;
	},
	
	includeSelectedDevices : function (_self)
	{
		if(_self.devGrid.selectedCells.length > 0)
		{
			for(var i=0; i<_self.devGrid.selectedCells.length; i++)
			{
				var cell = _self.devGrid.selectedCells[i];
				cellSrc = cell.getAttribute("data-src");
				cellDst = cell.getAttribute("data-dst");
				arrPushIfUnique(cellSrc, _self.includedSrcs);
				arrPushIfUnique(cellDst, _self.includedDsts);
				$(_self._container).trigger("getSignalsByDevice", cellSrc);
				$(_self._container).trigger("getSignalsByDevice", cellDst);
			}	
			_self.update_display();
		}
	},
	
	excludeSelectedDevices : function (_self)
	{
		if(_self.devGrid.selectedCells.length > 0)
		{
			for(var i=0; i<_self.devGrid.selectedCells.length; i++)
			{
				var cell = _self.devGrid.selectedCells[i];
				cellSrc = cell.getAttribute("data-src");
				cellDst = cell.getAttribute("data-dst");
				
				var ind;
				ind = _self.includedSrcs.indexOf(cellSrc);
				if(ind>=0) 
					_self.includedSrcs.splice(ind);
				ind = _self.includedDsts.indexOf(cellDst); 
				if(ind>=0) 
					_self.includedDsts.splice(ind);
				
				//FIX: need a command to remove signals from the model
				//command.send('tab', "mischkabibble");
			}	
			_self.update_display();
		}
	},
	
	update_display : function ()
	{
		this.updateDevicesGrid();
		this.updateSignalsGrid();		
	},
	
	updateDevicesGrid : function(){

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
		
		// add links
		
		var links = new Array();
		var l = this.model.links.keys();
		for (var i=0; i<l.length; i++)			
		{
			var src = this.model.links.get(l[i]).src_name;
			var dst = this.model.links.get(l[i]).dest_name;
			links.push([src,dst]);
		}
		
		this.devGrid.updateDisplayData(srcDevs, dstDevs, links);
		this.devGrid.refresh();
		
	},
	
	updateSignalsGrid : function(){
		
		// show signals for included srcs/destinations
		var srcSigs = new Array();
		var dstSigs = new Array();
		var connections = new Array();
		
		var keys = this.model.signals.keys();
	    for (var s in keys) {
	        var k = keys[s];
	        var sig = this.model.signals.get(k);
	        
	        //var lnk = this.model.links.get(selectedTab+'>'+sig.device_name);

			for (var i=0; i<this.includedSrcs.length; i++){
				if(sig.device_name == this.includedSrcs[i])
					srcSigs.push(sig);
			}
			for (var i=0; i<this.includedDsts.length; i++){
				if(sig.device_name == this.includedDsts[i])
					dstSigs.push(sig);
			}
	    }
	    
	    // add connections
		
		var c = this.model.connections.keys();
		for (var i=0; i<c.length; i++)			
		{
			var con = this.model.connections.get(c[i]);
			var src = this.model.connections.get(c[i]).src_name;
			var dst = this.model.connections.get(c[i]).dest_name;
			connections.push([src,dst]);
		}
	    
		this.sigGrid.updateDisplayData(srcSigs, dstSigs, connections);
		this.sigGrid.refresh();
	},
	
	on_resize : function ()
	{
		this.init();
		this.update_display();
	},
	
	calculateSizes : function ()
	{
		var w = $(this._container).width() - 8;
		if(this.viewMode == 3)
			w = Math.floor($(this._container).width()/2) - 8;
		
		var h = $(this._container).height() - $("#actionBar").height() - 2;
		
		document.getElementById("devGrid").style.width = w + "px";
		document.getElementById("devGrid").style.height = h + "px";
		document.getElementById("sigGrid").style.width = w + "px";
		document.getElementById("sigGrid").style.height = h + "px";
	},
	
	load_view_settings : function (data)
	{
		this.includedSrcs = data[0];
		this.includedDsts = data[1];
		this.switchView(data[2]);
		this.update_display();
	},
	
	save_view_settings : function ()
	{
		var data = [];
		data.push(this.includedSrcs);
		data.push(this.includedDsts);
		data.push(this.viewMode);
		return data;
	},
	
	cleanup : function ()
	{
		
	}
	
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

