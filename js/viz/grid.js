//+++++++++++++++++++++++++++++++++++++++++++ //
//		  	     Grid View Class		  	  //		 
//+++++++++++++++++++++++++++++++++++++++++++ //

function GridView(container, model)
{

	var _self = this;
	this._container = $(container);
	this.model = model;

	this.activeGridIndex = 0;
	this.devGrid;
	this.sigGrid;
	
	this.viewMode = 0;
	
	this.includedSrcs = new Array();
	this.includedDsts = new Array();
	
	this.init(container, model);

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
		
	init : function (container, model) 
	{ 
		var _self = this;	// to pass to the instance of LibMApperMatrixView to event handlers
		var div, btn;		// to instantiate items
		
		var wrapper = document.createElement("div");
		wrapper.setAttribute("id", "gridWrapper");
		container.appendChild(wrapper);
		
		// button bar
		div = document.createElement("div");
		div.setAttribute("id", "actionBar");
		div.setAttribute("style", "margin-bottom: 5px; margin-left: 16px; width: 200px;");
		
		// add device button
		btn = document.createElement("button");
		btn.innerHTML = "ADD";
		btn.addEventListener("click", function(evt){
			if(_self.devGrid.selectedCell)
				arrPushIfUnique(_self.devGrid.selectedCell.getAttribute("data-src"), _self.includedSrcs);
				arrPushIfUnique(_self.devGrid.selectedCell.getAttribute("data-dst"), _self.includedDsts);
				//FIX!
				//command.send('tab', _self.devGrid.selectedCell.getAttribute("data-src"));
				_self.update_display();
		});
		div.appendChild(btn);
			
		//remove device button
		btn = document.createElement("button");
		btn.innerHTML = "REM";
		btn.addEventListener("click", function(evt){
			if(_self.devGrid.selectedCell)
				arrPushIfUnique(_self.devGrid.selectedCell.getAttribute("data-src"), _self.includedSrcs);
				arrPushIfUnique(_self.devGrid.selectedCell.getAttribute("data-dst"), _self.includedDsts);
				//FIX
				//command.send('tab', "mischkabibble");
				_self.update_display();
		});
		div.appendChild(btn);

		// View Buttons
		btn = document.createElement("button");
		btn.innerHTML = "1";
		btn.addEventListener("click", function(evt){
			_self.switchView(1);
		});
		div.appendChild(btn);
		
		btn = document.createElement("button");
		btn.innerHTML = "2";
		btn.addEventListener("click", function(evt){
			_self.switchView(2);
		});
		div.appendChild(btn);
		btn = document.createElement("button");
		btn.innerHTML = "3";
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
		this.devGrid = new SvgGrid(document.getElementById("devGrid"), model, 0);
		
		// Signals Grid (gridIndex=1)
		div = document.createElement("div");
		div.setAttribute("id", "sigGrid");
		wrapper.appendChild(div);
		this.sigGrid = new SvgGrid(document.getElementById("sigGrid"), model, 1);
			
		
		$("#gridWrapper").width($("#devGrid").width() + $("#sigGrid").width() + 1);
		
		
		$("#devGrid").on("toggle", function(e, cell){
			_self.toggleLink(e, cell);
		});
		$("#sigGrid").on("toggle", function(e, cell){
			_self.toggleConnection(e, cell);
		});
		$("#devGrid").on("makeActiveGrid", function(e, gridIndex){
			_self.setActiveGrid(gridIndex);
		});
		$("#sigGrid").on("makeActiveGrid", function(e, gridIndex){
			_self.setActiveGrid(gridIndex);
		});
		
		this.switchView(1);	
	},
	
	switchView : function(mode){
		this.viewMode = mode;
		var len = 1000;
		switch (mode) 
		{
		case 1:
			$('#devGrid').show(len);
			$('#sigGrid').hide(len);
			break;
		case 2:
			$('#devGrid').hide(len);
			$('#sigGrid').show(len);
			break;
		case 3:
			$('#devGrid').show(len);
			$('#sigGrid').show(len);
			break;
		}
	},
	
	setActiveGrid : function(gridIndex){
		this.activeGridIndex = gridIndex;
	},
	
	toggleLink : function (e, cell)
	{
		var selectedSrc = cell.getAttribute("data-src");
		var selectedDst = cell.getAttribute("data-dst");
		
		// toggle the connection
		
		if(this.model.isLinked(selectedSrc, selectedDst) == false) // not already a connection, create the new connection
		{
			this._container.trigger("createLink", [selectedSrc, selectedDst]);	// trigger create connection event
		}
		else	// is already a connection, so remove it
		{
			// trigger remove connection event
			this._container.trigger("removeLink", [selectedSrc, selectedDst]);
			
			//style the cell
			/*
			if(this.mousedOverCell != null)	//style when mouse is over the toggled cell's row/col
			{	
				var mouseRow = this.mousedOverCell.getAttribute("data-row");
				var mouseCol = this.mousedOverCell.getAttribute("data-col");
				var selectedRow = cell.getAttribute("data-row");
				var selectedCol = cell.getAttribute("data-col");
				
				if(mouseRow == selectedRow || mouseCol == selectedCol)
					cell.setAttribute("class", "row_over cell_selected");
				else	
					cell.setAttribute("class", "cell_up cell_selected");
			}
			else	// style when no cell is moused over 
				cell.setAttribute("class", "cell_up cell_selected");
				*/
		}
		
	},
	
	toggleConnection : function (e, cell)
	{
		var selectedSrc = cell.getAttribute("data-src");
		var selectedDst = cell.getAttribute("data-dst");
		
		// toggle the connection
		
		if(this.model.isConnected(selectedSrc, selectedDst) == false) // not already a connection, create the new connection
		{
			// trigger create connection event
			this._container.trigger("createConnection", [selectedSrc, selectedDst]);
			// style appropriately for GUI
			cell.setAttribute("class", "cell_connected cell_selected");		
		}
		else	// is already a connection, so remove it
		{
			// trigger remove connection event
			this._container.trigger("removeConnection", [selectedSrc, selectedDst]);
			
			//style the cell
			
			if(this.mousedOverCell != null)	//style when mouse is over the toggled cell's row/col
			{	
				var mouseRow = this.mousedOverCell.getAttribute("data-row");
				var mouseCol = this.mousedOverCell.getAttribute("data-col");
				var selectedRow = cell.getAttribute("data-row");
				var selectedCol = cell.getAttribute("data-col");
				
				if(mouseRow == selectedRow || mouseCol == selectedCol)
					cell.setAttribute("class", "row_over cell_selected");
				else	
					cell.setAttribute("class", "cell_up cell_selected");
			}
			else	// style when no cell is moused over 
				cell.setAttribute("class", "cell_up cell_selected");
		}
	},
	
	
	keyboardHandler: function (e, _self)
	{
		if(this.activeGridIndex == 0)
			this.devGrid.keyboardHandler(e);
		else if(this.activeGridIndex == 1)
			this.sigGrid.keyboardHandler(e);
			
	},
	
	update_display : function (){
		
		this.updateDevicesGrid();
		this.updateSignalsGrid();
		
		var w = $(window).width();
		var w1 = $("#devGrid").width();
		var w2 = $("#sigGrid").width();
		
		if (this.viewMode == 1)
		{
			$("#gridWrapper").width( w1 + 1);
		}
	},
	
	updateDevicesGrid : function(){

		//divide devices into sources and destinations
		var srcDevs = new Array();
		var dstDevs = new Array();
		
		/*
		for (var i=0; i< this.model.devices.length; i++)
		{
			var dev = this.model.devices[i];
			if(dev.n_outputs>0)		//create new COL Label
				srcDevs.push(dev);
			if(dev.n_inputs>0)
				dstDevs.push(dev);
		}
		*/
		
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
		 
		this.devGrid.updateDisplay(srcDevs, dstDevs, this.model.links);
		
		
	},
	
	updateSignalsGrid : function(){
		
		// show signals for included srcs/destinations
		var srcSigs = new Array();
		var dstSigs = new Array();
		
		
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
		this.sigGrid.updateDisplay(srcSigs, dstSigs, this.model.connections);
	}
	
	// show the connections
	
	
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

