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
	
	this.viewPresets = [new GridViewPreset('Default Preset', [], [])];	// create empty preset
	this.viewPresetSelector;
	this.viewPresetIndex = 0;
	this.viewPresetCounter = 1;
	
	this.viewMode = 0;
	this.includedSrcs = [];
	this.includedDsts = [];
	
	this.init();
	this.setActiveGrid(this.activeGridIndex);
	this.filters = [ ["",""] , ["", ""]];

	//Keyboard handlers
	document.onkeydown = function(e){
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
		div.setAttribute("style", "float: left;");
		
		// view mode
		var comboBoxDiv = document.createElement("span");
		comboBoxDiv.title = "select a view mode";
		comboBoxDiv.setAttribute("class", "styled-select");
		comboBoxDiv.setAttribute("style", "float: left;");
		
		var comboBox = document.createElement("select");
		var option;
		
		option = document.createElement('option');
		option.value = '0';
		option.appendChild(document.createTextNode('Split View'));
		comboBox.appendChild(option);

		option = document.createElement('option');
		option.value = '1';
		option.appendChild(document.createTextNode('Devices View'));
		comboBox.appendChild(option);

		option = document.createElement('option');
		option.value = '2';
		option.appendChild(document.createTextNode('Signals View'));
		comboBox.appendChild(option);
		
		comboBox.addEventListener("change", function(evt){
			_self.switchView(this.selectedIndex);
		});
		
		comboBox.selectedIndex = this.viewMode;
		comboBoxDiv.appendChild(comboBox);
		div.appendChild(comboBoxDiv);
		// END view mode
		
		// add device button
		btn = document.createElement("button");
		btn.innerHTML = "Add";
		btn.setAttribute("style", "float: left;");
		btn.title = "include the selected device(s) in the SIGNALS grid (A)";
		btn.addEventListener("click", function(evt){
			_self.includeSelectedDevices();
		});
		div.appendChild(btn);
			
		//remove device button
		btn = document.createElement("button");
		btn.innerHTML = "Remove";
		btn.setAttribute("style", "float: left;");
		btn.title = "exclude the selected device(s) from the SIGNALS grid (S)";
		btn.addEventListener("click", function(evt){
			_self.excludeSelectedDevices();
		});
		div.appendChild(btn);
		
/*		
		// View Buttons
		btn = document.createElement("button");
		btn.innerHTML = "Split View";
		btn.title = "view DEVICES and SIGNALS grid (CTRL+1)";
		btn.addEventListener("click", function(evt){
			_self.switchView(0);
		});
		div.appendChild(btn);
		
		btn = document.createElement("button");
		btn.innerHTML = "Devices Only";
		btn.title = "solo DEVICES grid (CTRL+2)";
		btn.addEventListener("click", function(evt){
			_self.switchView(1);
		});
		div.appendChild(btn);
		
		btn = document.createElement("button");
		btn.innerHTML = "Signals Only";
		btn.title = "solo SIGNALS grid (CTRL+3)";
		btn.addEventListener("click", function(evt){
			_self.switchView(2);
		});
		div.appendChild(btn);
*/		
		
		// view presets
		btn = document.createElement("button");
		btn.innerHTML = "Delete";
		btn.title = "delete the current preset";
		btn.setAttribute("style", "float: right;");
		btn.addEventListener("click", function(evt){
			_self.deleteViewPreset();
		});
		div.appendChild(btn);
		
		btn = document.createElement("button");
		btn.innerHTML = "Update";
		btn.title = "save the current configution into the current preset";
		btn.setAttribute("style", "float: right;");
		btn.addEventListener("click", function(evt){
			_self.updateViewPreset();
		});
		div.appendChild(btn);
		
		btn = document.createElement("button");
		btn.innerHTML = "Save New";
		btn.title = "save the current configuration as a preset";
		btn.setAttribute("style", "float: right;");
		btn.addEventListener("click", function(evt){
			_self.saveViewPreset();
		});
		div.appendChild(btn);

		comboBoxDiv = document.createElement("span");
		comboBoxDiv.setAttribute("class", "styled-select");
		comboBoxDiv.setAttribute("style", "float: right;");
		comboBoxDiv.title = "choose a preset (ALT + up/right arrow)";
		
		this.viewPresetSelector = document.createElement("select");
		this.viewPresetSelector.setAttribute("id", "viewPresetSelector");
		var option;
		for(var i=0; i<this.viewPresets.length; i++)
		{
			option = document.createElement('option');
			option.value = i;
			option.appendChild(document.createTextNode(this.viewPresets[i].name));
			this.viewPresetSelector.appendChild(option);
		}
		this.viewPresetSelector.selectedIndex = this.viewPresetIndex;

		this.viewPresetSelector.addEventListener("change", function(evt){
			_self.loadViewPreset(this.selectedIndex);
		});
		
		comboBoxDiv.appendChild(this.viewPresetSelector);
		div.appendChild(comboBoxDiv);		
		//END view presets
		
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
		
		// FIX part 1/2
		// saving selected cell to restore after being re-initialized
		// ideally should not be redrawing everything but just updating SVG dimensions on_resize
		// however on_resize is giving trouble calculating the font size zoom because aspect ratio changes
		var prevSelectedDev;
		var prevMousedOver;
		if(this.devGrid && this.devGrid.selectedCells)
			prevSelectedDev = this.devGrid.selectedCells;
		if(this.devGrid && this.devGrid.mousedOverCell)
			prevMousedOver = this.devGrid.mousedOverCell;
		var prevSelectedSig;
		if(this.sigGrid && this.sigGrid.selectedCells)
			prevSelectedSig = this.sigGrid.selectedCells;
		
		this.devGrid = new GridDevices();
		this.devGrid.preInit(document.getElementById("devGrid"), this.model, 0);
		this.devGrid.includedSrcs = this.includedSrcs;	// sets the binding for included sources
		this.devGrid.includedDsts = this.includedDsts;	// sets the binding for included sources
		
		this.sigGrid = new GridSignals();
		this.sigGrid.preInit(document.getElementById("sigGrid"), this.model, 1);

		// FIX part 2/2
		if(prevSelectedDev)
			this.devGrid.selectedCells_restore(prevSelectedDev);
		if(prevMousedOver)
			this.devGrid.mousedOverCell = prevMousedOver;
		if(prevSelectedSig)
			this.sigGrid.selectedCells_restore(prevSelectedSig);
		
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
		$("#devGrid").on("filterChanged", function(e, filters){
			e.stopPropagation();	//prevents bubbling to main.js
			_self.filters[0] = filters;
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
		$("#sigGrid").on("filterChanged", function(e, filters){
			e.stopPropagation();	//prevents bubbling to main.js
			_self.filters[1] = filters;
		});


		
		$("#devGrid").on("updateConnectionProperties", function(e){
			e.stopPropagation();	//prevents bubbling to main.js
			// only sig grid needs this function
		});
		$("#sigGrid").on("updateConnectionProperties", function(e){
			e.stopPropagation();	//prevents bubbling to main.js
			$(_self._container).trigger("updateConnectionProperties");	// trigger update topMenu event
		});
		
		
		$("#devGrid").on("makeActiveGrid", function(e, gridIndex){
			e.stopPropagation();	//prevents bubbling to main.js
			_self.setActiveGrid(gridIndex);
		});
		$("#sigGrid").on("makeActiveGrid", function(e, gridIndex){
			e.stopPropagation();	//prevents bubbling to main.js
			_self.setActiveGrid(gridIndex);
		});
		
		
		// on resize, this init function is called again, so re-instate the view mode
		switch (this.viewMode) 
		{
		case 0:
			$('#devGrid').show();
			$('#sigGrid').show();
			break;
		case 1:
			$('#devGrid').show();
			$('#sigGrid').hide();
			break;
		case 2:
			$('#devGrid').hide();
			$('#sigGrid').show();
			break;
		}
		this.setActiveGrid(this.activeGridIndex);
		
	},
	
	switchView : function(mode)
	{
		if(mode == this.viewMode)
			return;
		
		this.viewMode = mode;

		this.on_resize();
		
		switch (mode) 
		{
		case 0:
			$('#devGrid').show();
			$('#sigGrid').show();
			this.setActiveGrid(this.activeGridIndex);
			break;
		case 1:
			$('#devGrid').show();
			$('#sigGrid').hide();
			this.setActiveGrid(0);
			break;
		case 2:
			$('#devGrid').hide();
			$('#sigGrid').show();
			this.setActiveGrid(1);
			break;
		}
	},
	
	setActiveGrid : function(gridIndex){
		this.activeGridIndex = gridIndex;
		document.getElementById("activeIndicator" + gridIndex).setAttribute("class", "activeGridIndicator");
		document.getElementById("activeIndicator" + (1-gridIndex)).setAttribute("class", "inactiveGridIndicator");
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
	
	
	keyboardHandler: function (e)
	{
		//console.log(e.keyCode);
		
		// 'ctrl' + '1 / 2 / 3 ' to change view modes
		if(e.keyCode == 49 && e.ctrlKey)
			this.switchView(0);
		else if(e.keyCode == 50 && e.ctrlKey)
			this.switchView(1);
		else if(e.keyCode == 51 && e.ctrlKey)
			this.switchView(2);
		// 'ALT + left/right to move the active grid
		else if( (e.keyCode == 37 || e.keyCode == 39 ) && e.altKey)
		{
			if(this.viewMode == 0)
				if(e.keyCode == 37)	// left
					this.setActiveGrid(0);
				else{				// right
					if(this.includedSrcs.length > 0 && this.includedDsts.length > 0)	// only if there are signals
						this.setActiveGrid(1);
				}
		}
		// 'ALT + up/down to cycle through presets
		else if( e.keyCode == 38 && e.altKey)	// up
		{
			if(this.viewPresets.length == 0)
				return
			this.viewPresetIndex--;
			if(this.viewPresetIndex < 0)
				this.viewPresetIndex = this.viewPresets.length -1;	// loop to end
			this.loadViewPreset(this.viewPresetIndex);
		}
		else if( e.keyCode == 40 && e.altKey)	// up
		{
			if(this.viewPresets.length == 0)
				return
			this.viewPresetIndex++;
			if(this.viewPresetIndex >= this.viewPresets.length)
				this.viewPresetIndex = 0;	// loop to beginning
			this.loadViewPreset(this.viewPresetIndex);
		}
		
		// else pass it to the active view
		else if(this.activeGridIndex == 0)
		{
			// 'a' to include
			if(e.keyCode == 65)	
				this.includeSelectedDevices();

			// 's' to exclude
			else if(e.keyCode == 83)	
				this.excludeSelectedDevices();

			else
				this.devGrid.keyboardHandler(e);
		}
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
	
	includeSelectedDevices : function ()
	{
		// for selected cells
		if(this.devGrid.selectedCells.length > 0)
		{
			for(var i=0; i<this.devGrid.selectedCells.length; i++)
			{
				var cell = this.devGrid.selectedCells[i];
				var cellSrc = cell.getAttribute("data-src");
				var cellDst = cell.getAttribute("data-dst");
				arrPushIfUnique(cellSrc, this.includedSrcs);
				arrPushIfUnique(cellDst, this.includedDsts);
				$(this._container).trigger("getSignalsByDevice", cellSrc);
				$(this._container).trigger("getSignalsByDevice", cellDst);
			}	
			this.update_display();
		}
		// for selected labels
		if(this.devGrid.selectedLabels.length > 0)
		{
			for(var i=0; i<this.devGrid.selectedLabels.length; i++)
			{
				var label = this.devGrid.selectedLabels[i];
				if(label.hasAttribute("data-src"))
				{
					var labelSrc = label.getAttribute("data-src");
					arrPushIfUnique(labelSrc, this.includedSrcs);
					$(this._container).trigger("getSignalsByDevice", labelSrc);
				}
				if(label.hasAttribute("data-dst"))
				{
					var labelDst = label.getAttribute("data-dst");
					arrPushIfUnique(labelDst, this.includedDsts);
					$(this._container).trigger("getSignalsByDevice", labelDst);
				}
			}	
			this.update_display();
		}
	},
	
	excludeSelectedDevices : function ()
	{
		// for selected cells
		if(this.devGrid.selectedCells.length > 0)
		{
			for(var i=0; i<this.devGrid.selectedCells.length; i++)
			{
				var cell = this.devGrid.selectedCells[i];
				var cellSrc = cell.getAttribute("data-src");
				var cellDst = cell.getAttribute("data-dst");
				
				var ind;
				ind = this.includedSrcs.indexOf(cellSrc);
				if(ind>=0) 
					this.includedSrcs.splice(ind, 1);
				ind = this.includedDsts.indexOf(cellDst); 
				if(ind>=0) 
					this.includedDsts.splice(ind, 1);
			}	
			this.update_display();
		}
		// for selected labels		
		if(this.devGrid.selectedLabels.length > 0)
		{
			for(var i=0; i<this.devGrid.selectedLabels.length; i++)
			{
				var label = this.devGrid.selectedLabels[i];
				
				if(label.hasAttribute("data-src"))
				{
					var labelSrc = label.getAttribute("data-src");
					var ind = this.includedSrcs.indexOf(labelSrc);
					if(ind>=0) 
						this.includedSrcs.splice(ind, 1);
				}
				if(label.hasAttribute("data-dst"))
				{
					var labelDst = label.getAttribute("data-dst");
					var ind = this.includedDsts.indexOf(labelDst); 
					if(ind>=0) 
						this.includedDsts.splice(ind, 1);
				}
			}	
			this.update_display();
		}
	},
	
	update_display : function ()
	{
		this.updateDevicesGrid();
		this.updateSignalsGrid();		
	},
	
	updateDevicesGrid : function(){

		//divide devices into sources and destinations
		var devs = this.model.getDevices();
		
		// add links
		var links = new Array();
		var l = this.model.links.keys();
		for (var i=0; i<l.length; i++)			
		{
			var src = this.model.links.get(l[i]).src_name;
			var dst = this.model.links.get(l[i]).dest_name;
			links.push([src,dst]);
		}
		
		this.devGrid.updateDisplayData(devs[0], devs[1], links);
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
		var w = $(this._container).width() -2;
		document.getElementById("actionBar").style.width = (w-12) + "px";
		
		if(this.viewMode == 0)
			w = Math.floor(w/2);
		
		var h = $(this._container).height() - $("#actionBar").height() - $("#logoWrapper").height() - 2;
		
		
		document.getElementById("devGrid").style.width = w + "px";
		document.getElementById("devGrid").style.height = h + "px";
		document.getElementById("sigGrid").style.width = w + "px";
		document.getElementById("sigGrid").style.height = h + "px";
	},
	
	saveViewPreset : function()
	{
		if(this.includedSrcs.length == 0 && this.includedDsts.length == 0)
			return;
		
		var name = 'Preset ' + this.viewPresetCounter++;
		var newPreset = new GridViewPreset(name, this.includedSrcs.slice(0), this.includedDsts.slice(0));
		this.viewPresets.push(newPreset);
		
		var option = document.createElement('option');
		option.value = this.viewPresets.length-1;
		option.appendChild(document.createTextNode(name));
		this.viewPresetSelector.appendChild(option);
		this.viewPresetIndex = this.viewPresets.length-1;
		this.viewPresetSelector.selectedIndex = this.viewPresets.length-1;
	},
	
	updateViewPreset : function()
	{
		if(this.includedSrcs.length == 0 && this.includedDsts.length == 0)
			return;
		
		var preset = this.viewPresets[this.viewPresetIndex];
		preset.includedSrcs = this.includedSrcs.slice(0);
		preset.includedDsts = this.includedDsts.slice(0);
	},
	
	loadViewPreset : function(index)
	{
		var preset = this.viewPresets[index];
		this.viewPresetIndex = index;
		this.viewPresetSelector.selectedIndex = index;
		this.includedSrcs = preset.includedSrcs.slice(0);	// slice to return clone, not reference
		this.includedDsts = preset.includedDsts.slice(0);
		this.devGrid.includedSrcs = this.includedSrcs;
		this.devGrid.includedDsts = this.includedDsts;
		this.update_display();
		this.devGrid.zoomToFit();
		this.sigGrid.zoomToFit();
		if(index == 0)
			this.setActiveGrid(0);
	},
	
	deleteViewPreset : function()
	{
		var index = this.viewPresetSelector.selectedIndex; 
		if(index > 0)
		{
			this.viewPresets.splice(index, 1);
			this.loadViewPreset(0);
			this.viewPresetSelector.selectedIndex = 0;
			this.viewPresetSelector.options[index] = null;
		}
		
	},
	
	load_view_settings : function (data)
	{
		this.includedSrcs = data[0];
		this.includedDsts = data[1];
		this.switchView(data[2]);
		this.setActiveGrid(data[3]);
		this.viewPresets = data[4];
		this.viewPresetIndex = data[5];
		this.viewPresetCounter = data[6];
		this.init();
		this.loadViewPreset(this.viewPresetIndex);
	},
	
	save_view_settings : function ()
	{
		var data = [];
		data.push(this.includedSrcs);		// 0
		data.push(this.includedDsts);		// 1
		data.push(this.viewMode);			// 2
		data.push(this.activeGridIndex);	// 3
		data.push(this.viewPresets);		// 4
		data.push(this.viewPresetIndex);	// 5
		data.push(this.viewPresetCounter);	// 6
		
		
		return data;
	},
	
	cleanup : function ()
	{
		document.onkeydown = null;
	}
	
};

function GridViewPreset(name, includedSrcs, includedDsts)
{
	this.name = name;
	this.includedSrcs = includedSrcs;
	this.includedDsts = includedDsts;
};
