//+++++++++++++++++++++++++++++++++++++++++++ //
//		  	     Hive View Class		  	  //		 
//+++++++++++++++++++++++++++++++++++++++++++ //

function HivePlotView(container, model)
{
	this.svgNS = "http://www.w3.org/2000/svg";
	this.svgNSxlink = "http://www.w3.org/1999/xlink";
	var _self = this;

	this.svg;					// holding <SVG> elements for easy reference
	this.svgDim = [800, 600]; 	// x-y dimensions of the svg canvas
	this.mode = 1;
	this.inclusionTableWidth = 228;
	this.inclusionTablePadding = 10;
	this.actionBarHeight = 68;
	this.actionBarPadding = 8;
	this.groupColors = ["Cyan", "Orange", "Yellow", "Red", "DodgerBlue", "PeachPuff", "BlanchedAlmond", "DarkViolet", "PaleGreen", "Silver", "AntiqueWhite", "LightSteelBlue" ];
	this.pColors;

	this._container = container;
	this.model = model;
	
	// 0 for sources, 1 for destinations
	this.devs = [[],[]];
	this.sigs = [[],[]];
	
	// SVG display items
	this.nodes = [[],[]];
	this.connectionsLines = [];
	this.deviceLines = [];
	
	this.excludedDevs = [[],[]];
	this.selectedCells = [[],[]];
	this.selectedConnections = [];
	this.expandedDevices = [[],[]];
	this.filters = ["", ""];

	this.initColorPointers();
	
	//Keyboard handlers
	document.onkeydown = function(e){
		_self.keyboardHandler(e);
	};
	
	// http://code.stephenmorley.org/javascript/collapsible-lists/
	this.CollapsibleLists = new function()
	{
	      /* Makes the specified list collapsible. The parameters are:
	       * node         - the list element
	       * doNotRecurse - true if sub-lists should not be made collapsible
	       */
	      this.applyTo = function(node, expandedList, doNotRecurse)
	      {
	        // loop over the list items within this node
	        var lis = node.getElementsByTagName('li');
	        for (var index = 0; index < lis.length; index ++){

	          // check whether this list item should be collapsible
	          if (!doNotRecurse || node == lis[index].parentNode){

	            // prevent text from being selected unintentionally
	            if (lis[index].addEventListener){
	              lis[index].addEventListener(
	                  'mousedown', function (e){ e.preventDefault(); }, false);
	            }else{
	              lis[index].attachEvent(
	                  'onselectstart', function(){ event.returnValue = false; });
	            }

	            // add the click listener
	            if (lis[index].addEventListener){
	              lis[index].addEventListener(
	                  'click', createClickListener(lis[index]), false);
	            }else{
	              lis[index].attachEvent(
	                  'onclick', createClickListener(lis[index]));
	            }

	            // close the unordered lists within this list item
	            if(arrIsUnique(lis[index].getAttribute("data-src"), expandedList))
	            	toggle(lis[index]);

	          }
	        }

	      };

	      /* Returns a function that toggles the display status of any unordered
	       * list elements within the specified node. The parameter is:
	       *
	       * node - the node containing the unordered list elements
	       */
	      function createClickListener(node){

	        // return the function
	        return function(e){

	          // ensure the event object is defined
	          if (!e) e = window.event;

	          // find the list item containing the target of the event
	          var li = (e.target ? e.target : e.srcElement);
	          while (li.nodeName != 'LI') li = li.parentNode;

	          // toggle the state of the node if it was the target of the event
	          if (li == node) toggle(node);

	        };

	      }

	      /* Opens or closes the unordered list elements directly within the
	       * specified node. The parameter is:
	       *
	       * node - the node containing the unordered list elements
	       */
	      function toggle(node)
	      {
	        // determine whether to open or close the unordered lists
	        var open = node.className.match(/(^| )collapsibleListClosed( |$)/);

	        // loop over the unordered list elements with the node
	        var uls = node.getElementsByTagName('ul');
	        for (var index = 0; index < uls.length; index ++){

	          // find the parent list item of this unordered list
	          var li = uls[index];
	          while (li.nodeName != 'LI') li = li.parentNode;

	          // style the unordered list if it is directly within this node
	          if (li == node) uls[index].style.display = (open ? 'block' : 'none');

	        }

	        // remove the current class from the node
	        node.className =
	            node.className.replace(
	                /(^| )collapsibleList(Open|Closed)( |$)/, '');

	        // if the node contains unordered lists, set its class
	        if (uls.length > 0){
	          node.className += ' collapsibleList' + (open ? 'Open' : 'Closed');
	        }

	      }
	    }();
}

HivePlotView.prototype = {
	
	init : function () 
	{ 
		var _self = this;	// to pass to the instance of LibMApperMatrixView to event handlers
		var div, btn, wrapper;		// to instantiate items
		
		// clear the previous data
		this.devs = [[],[]];
		this.sigs = [[],[]];
		this.nodes = [[],[]];
		this.connectionsLines = [];
		this.deviceLines = [];
		this.initColorPointers();
		
		// remove all previous DOM elements
		$(this._container).empty();
		wrapper = document.createElement("div");
		wrapper.setAttribute("id", "hiveWrapper");
		this._container.appendChild(wrapper);

		// add SVG canvas
		this.svg = document.createElementNS(this.svgNS,"svg");
		this.svg.setAttribute("id", "HivePlotSVG");
		this.svg.setAttribute("xmlns", this.svgNS);
		this.svg.setAttribute("xmlns:xlink", this.svgNSxlink);
		this.svg.setAttribute("width", this.svgDim[0]);
		this.svg.setAttribute("height", this.svgDim[1]);
		this.svg.setAttribute("style", "float:left;margin-left: 5px; margin-bottom: 5px");
		wrapper.appendChild(this.svg);	
		
		// add list of devices on left
		div = document.createElement("div");
		div.setAttribute("id", "hive_inclusionTable");
//		div.setAttribute("style", "width: "+ (this.inclusionTableWidth-(2*this.inclusionTablePadding)) + "px; height: " + (this.svgDim[1] + this.actionBarHeight + (2*this.actionBarPadding) +4) + "px; overflow-y: scroll; padding: " + this.inclusionTablePadding + "px;");
//		div.setAttribute("style", "width: "+ (this.inclusionTableWidth-(2*this.inclusionTablePadding)) + "px; height: " + (this.svgDim[1]) + "px; overflow-y: scroll; padding: " + this.inclusionTablePadding + "px;");
		div.setAttribute("style", "width: "+ (this.inclusionTableWidth-(2*this.inclusionTablePadding)) + "px; height: " + (this.svgDim[1]) + "px; overflow-y: scroll;");
		this._container.appendChild(div);
		
		// add display bar 
	    div = document.createElement("div");
		div.setAttribute("id", "hive_actionBar");
		div.title = "click to toggle a connection";
//		div.setAttribute("style", "width: "+ (this.svgDim[0] + (2*this.inclusionTablePadding)) + "px; height: "+ (this.actionBarHeight - (2*this.actionBarPadding)) + "px; padding: " + this.actionBarPadding + "px; ");
//		div.setAttribute("style", "width: "+ (this.svgDim[0] ) + "px; height: "+ (this.actionBarHeight - (2*this.actionBarPadding)) + "px; padding: " + this.actionBarPadding + "px; ");
		div.setAttribute("style", "width: 100%; height: "+ (this.actionBarHeight) + "px;");
		div.addEventListener("click", function(evt){
			_self.toggleConnection();
		});
		this._container.appendChild(div);
	    
		// add filters
		wrapper = document.createElement("div");
		wrapper.setAttribute("id", "hive_filtersBar");
		var l = document.createElement("span");
		l.innerHTML = "Source/Destination Filters";
		l.setAttribute("class", "inclusionFiltersH2");
		wrapper.appendChild(l);
		wrapper.appendChild(document.createElement("br"));
		for(var ind=0; ind<2; ind++)
		{
			var filter; 
			filter = document.createElement("input");
			filter.value = this.filters[ind]; 
			filter.setAttribute("class", "namespaceFilter");
			filter.setAttribute("style", "width: " + (this.inclusionTableWidth - 41) + "px");
			filter.setAttribute("data-ind", ind);
			filter.addEventListener("keydown", function(evt){
				// don't know why but filter not working on keydown
				// and causing problems... 
				evt.stopPropagation();
			});
			filter.addEventListener("keyup", function(evt){
				evt.stopPropagation();
				_self.filters[evt.target.getAttribute("data-ind")] = evt.target.value;
				_self.redrawInclusionTable();
			});
			wrapper.appendChild(filter);
			if(ind == 0)
				wrapper.appendChild(document.createElement("br"));
		}
		this._container.appendChild(wrapper);
		
		this.draw();
	},
	
	initDefinitions: function ()
	{

		var defs = document.createElementNS(this.svgNS, "defs");
		
		// circle marker for endpoints of connection line
		var marker = document.createElementNS(this.svgNS, "marker");
		marker.setAttribute('id', "hive_connectionMarker");
		marker.setAttribute('markerWidth', 7);
		marker.setAttribute('markerHeight', 7);
		marker.setAttribute('refX', 5);
		marker.setAttribute('refY', 5);
		marker.setAttribute('viewBox', "0 0 12 12 ");
		var mark = document.createElementNS(this.svgNS,"circle");
		mark.setAttribute("cx", 5);
		mark.setAttribute("cy", 5);
		mark.setAttribute("r", 4);
		mark.setAttribute("fill", "#000000");
		marker.appendChild(mark);
		defs.appendChild(marker);
		
		this.svg.appendChild(defs);
	},
	
	draw : function()
	{
		this.initDefinitions();
		this.drawBackground();
		this.initDevices();
		
		// hive plot
		if(this.mode == 0)
		{
			this.drawAxes(this.devs[0], 0);
			this.drawAxes(this.devs[1], 1);
		}
		// adapted hive plot
		else if(this.mode == 1)
		{
			var origin = [(this.svgDim[0]/2) + 10, this.svgDim[1]/2];				// origin of ellipses
			var innerDim = [this.svgDim[0]/10, this.svgDim[1]/10] ;										// inner ellipse dimensions
			var outerDim = [this.svgDim[0]/2, (this.svgDim[1]/2) - 15];	// outer ellipse dimensions
			this.drawAxes2(this.devs[0], 0, origin[0], origin[1], innerDim[0], innerDim[1], outerDim[0], outerDim[1], 195, 345);
			this.drawAxes2(this.devs[1], 1, origin[0], origin[1], innerDim[0], innerDim[1], outerDim[0], outerDim[1], 15, 165);
		}
		// not used anymore (adapted hive plot with a different center)
		else if(this.mode == 2)
		{
			var origin = [15, this.svgDim[1]/2];				// origin of ellipses
			var innerDim = [this.svgDim[0]/10, this.svgDim[1]/10] ;										// inner ellipse dimensions
			var outerDim = [this.svgDim[0] - 15, (this.svgDim[1]/2) - 15];	// outer ellipse dimensions
			this.drawAxes2(this.devs[0], 0, origin[0], origin[1], innerDim[0], innerDim[1], outerDim[0], outerDim[1], 285, 345);
			this.drawAxes2(this.devs[1], 1, origin[0], origin[1], innerDim[0], innerDim[1], outerDim[0], outerDim[1], 15, 85);
		}
		this.drawInclusionTable();
		this.drawNodes();	// drawn separately and later for z-index
		this.drawConnections();
		this.drawActionBar();
		
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
	
	// handler for keyboard events
	keyboardHandler: function (e)
	{
		//console.log(e.keyCode);
		
		// 'c' to connect
		if(e.keyCode == 67)	
		{
				this.connect();
		}	

		// 'd' to disconnect
		else if(e.keyCode == 68)	
		{
				this.disconnect();
		}
		// 'ctrl' + '1 / 2' to change view modes
		else if(e.keyCode == 49 && e.ctrlKey)
			this.switchView(0);
		else if(e.keyCode == 50 && e.ctrlKey)
			this.switchView(1);
		
	},
	
	// divide devices from model into sources and destinations
	initDevices : function ()
	{
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
		
		// sort devices
		this.devs[0].sort(this.compareDeviceLabel);
		this.devs[1].sort(this.compareDeviceLabel);

	},
	
	// draw background for SVG, can be styles as a gradient in the CSS
	drawBackground : function ()
	{
		var bk = document.createElementNS(this.svgNS,"rect");
		bk.setAttribute("x", 0);
		bk.setAttribute("x", 0);
		bk.setAttribute("width", this.svgDim[0]);
		bk.setAttribute("height", this.svgDim[1]);
    	bk.setAttribute("class", "hive_svg");
    	this.svg.appendChild(bk);
	},
	
	redrawInclusionTable : function ()
	{
		var table = document.getElementById("hive_inclusionTable");
		while (table.hasChildNodes()) {
			table.removeChild(table.lastChild);
		}
		this.drawInclusionTable();
	},
	
	// draw bar with the action buttons and list of devices
	drawInclusionTable : function ()
	{
		var _self = this;
		var table = document.getElementById("hive_inclusionTable");

		var btn;
		
		// switch mode button
		btn = document.createElement("button");
		btn.innerHTML = "Mode";
		btn.title = "switch hive plot style";
		btn.addEventListener("click", function(evt){
			_self.switchMode();
		});
		//table.appendChild(btn);		// not included for release

		// show all button
		btn = document.createElement("button");
		btn.innerHTML = "Show All";
		btn.title = "show all devices";
		btn.addEventListener("click", function(evt){
			_self.includeAllDevices();
			_self.update_display();
		});
		table.appendChild(btn);
		
		// hide all button
		btn = document.createElement("button");
		btn.innerHTML = "Hide All";
		btn.title = "hide all devices";
		btn.addEventListener("click", function(evt){
			_self.excludeAllDevices();
			_self.update_display();
		});
		table.appendChild(btn);
		
		// expand all button
		btn = document.createElement("button");
		btn.innerHTML = "Expand All";
		btn.title = "expand all devices";
		btn.addEventListener("click", function(evt){
			_self.expandAllDevices();
			_self.update_display();
		});
		table.appendChild(btn);
		
		// collapse all button
		btn = document.createElement("button");
		btn.innerHTML = "Collapse All";
		btn.title = "collapse all devices";
		btn.addEventListener("click", function(evt){
			_self.collapseAllDevices();
			_self.update_display();
		});
		table.appendChild(btn);
		
		table.appendChild(document.createElement('br'));
		
		// connect button
		btn = document.createElement("button");
		btn.innerHTML = "Connect";
		btn.title = "connect the selected node(s) (C)";
		btn.addEventListener("click", function(evt){
			_self.connect();
		});
		table.appendChild(btn);
		
		// disconnect button
		btn = document.createElement("button");
		btn.innerHTML = "Disconnect";
		btn.title = "disconnect the selected connection) (D)";
		btn.addEventListener("click", function(evt){
			_self.disconnect();
		});
		table.appendChild(btn);

		table.appendChild(document.createElement('br'));
		
		// repeat for source and destination devices
		var labels = ["Sources", "Destinations"];
		for(var ind=0; ind<2; ind++)
		{
			table.appendChild(document.createElement('br'));
			
			var l = document.createElement("p");
			l.innerHTML = labels[ind];
			l.setAttribute("class", "inclusionTableH2");
			table.appendChild(l);
			
			// prep filter
			var filterText = this.filters[ind];
			var regExp = new RegExp(filterText, 'i');

			// for each device
			for(var i=0; i<this.devs[ind].length; i++)
			{
				var dev = this.devs[ind][i];
				var label = dev.name;
				
				// if filter matches device, include device and all its signals
				// if not matched, below we check for signals that match and include the device only if there's atleast 1 matched signal
				var deviceMatched = false;
				if( regExp.test(dev.name) ) 
					deviceMatched = true;
				
				// ul for the device
				var devList = document.createElement("ul");
				devList.setAttribute("class", "treeView");
				
				var devItem;
				devItem = document.createElement("li");
				devItem.setAttribute("data-src", dev.name);
				devItem.setAttribute("data-ind", ind);
				
				// include/exclude checkbox
				var checkbox = document.createElement('input');
				checkbox.type = "checkbox";
				checkbox.setAttribute("data-check", "yes");
				checkbox.name = label;
				checkbox.value = label;
				checkbox.checked = (arrIsUnique(label, this.excludedDevs[ind]));
				if(ind==0){
					checkbox.addEventListener("click", function(evt){
						evt.preventDefault();
						evt.stopPropagation();
						_self.onInclusionTableChecked(evt, 0);
						_self.update_display();
					});
				}else if(ind==1){
					checkbox.addEventListener("click", function(evt){
						evt.preventDefault();
						evt.stopPropagation();
						_self.onInclusionTableChecked(evt, 1);
						_self.update_display();
					});
				}
				devItem.appendChild(checkbox);
				devItem.appendChild(document.createTextNode(label));
				
				// ul for signals of the device
				
				var sigMatched = false;
				var sigList = document.createElement("ul");
				var keys = this.model.signals.keys();
				
				// adding signals of the device that match the regex to a temp array for sorting
				var sigsTemp = [];
				for (var s in keys) 
				{
					var k = keys[s];
					var sig = this.model.signals.get(k);
					if(sig.device_name == dev.name)
					{
						// set the flas to add the device if a signal is matched
						if(regExp.test(sig.name))
							sigMatched = true;
						
						// if device was matched we include all its signals
						// if device not matched we only include signals matching the regex
						if(deviceMatched || regExp.test(sig.name))
						sigsTemp.push(sig);
					}
				}
				
				// sort the signals
				sigsTemp.sort(this.compareSignalLabel);
				
				// create the list elements for the sorted signals
				for (var k=0; k<sigsTemp.length; k++) 
				{
					var sig = sigsTemp[k];

					var sigItem = document.createElement("li");
					sigItem.setAttribute("data-src", dev.name);
					sigItem.setAttribute("data-srcSignal", sig.name);
					sigItem.setAttribute("data-ind", ind);
					sigItem.innerHTML = sig.name;
					sigList.appendChild(sigItem);
					
					// check if selected and style
					if(this.selectedCells_getCellIndex(sigItem, ind) == -1)
						sigItem.setAttribute("class", "signalLabel");
					else
						sigItem.setAttribute("class", "signalLabel_selected");
				}
				
				devItem.appendChild(sigList);
				
				// only add if device or atleast one signal is included 
				if(deviceMatched || sigMatched)
					devList.appendChild(devItem);
				
				table.appendChild(devList);
				
				this.CollapsibleLists.applyTo(devList, this.expandedDevices[ind], true);
				
				// click mouse event handler
				devList.addEventListener("click", function(evt){
					var target = evt.target;

					// signal under mouse
					if(target.hasAttribute("data-srcSignal"))
					{
						_self.onNodeClick(target);
					}
					// device under mouse
					else if(target.hasAttribute("data-src"))
					{
						var src = target.getAttribute("data-src");
						var n = target.getAttribute("data-ind");
						var index = _self.expandedDevices[n].indexOf(src);
						if(index == -1)
							_self.expandedDevices[n].push(src);
						else
							_self.expandedDevices[n].splice(index, 1);
					}
				});
				
				// mouse over event handler
				devList.addEventListener("mouseover", function(evt){
					var target = evt.target;

					// signal under mouse
					if(target.hasAttribute("data-srcSignal"))
					{
						_self.onNodeMouseOver(evt.target);
					}
					// device under mouse
					else if(target.hasAttribute("data-src"))
					{
						_self.onDevMouseOver(evt.target.getAttribute("data-src"));
					}
				});
				
				// mouse out event handler
				devList.addEventListener("mouseout", function(evt){
					
					// signal under mouse
					if(evt.target.hasAttribute("data-srcSignal"))
					{
						_self.onNodeMouseOut(evt.target);
					}
					// device under mouse
					else if(evt.target.hasAttribute("data-src"))
					{
						_self.onDevMouseOut(evt.target.getAttribute("data-src"));
					}
				});
				
				
			}
		}
		
	},
	
	// handler for clicking on a checkbox in the list of devices
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
			arrPushIfUnique(devName, this.excludedDevs[ind]);
	},
	
	// bar on bottom showing the names of the selected nodes
	// bar can also be clicked on to toggle a connection
	drawActionBar : function()
	{
		var _self = this;
		var table = document.getElementById("hive_actionBar");

		for(var ind=0; ind<2; ind++)
		{
			if(this.selectedCells[ind].length > 0)
			{
				var label = document.createElement("p");
				var src = this.selectedCells[ind][0];
				//var text = (ind==0)? "Source: " : "Destination: ";
				var text = "";
				text += src.getAttribute("data-src") + src.getAttribute("data-srcSignal");
				label.appendChild(document.createTextNode(text));
				label.setAttribute("class", (ind==0)? "hive_srcLabel" : "hive_dstLabel");
				table.appendChild(label);
			}			
		}
	},
	
	// plot for mode 1 (hive plot, 2 axes consisting of 1 for the source and 1 for the destination)
	drawAxes : function (srcData, ind)
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
		line.setAttribute("class", "hive_axis");
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
		    	node.setAttribute("data-src", sig.device_name);
		    	node.setAttribute("data-srcSignal", sig.name);
		    	node.setAttribute("data-ind", ind);
		    	node.setAttribute("cx", pt.x);
		    	node.setAttribute("cy", pt.y);
		    	node.setAttribute("r", 5);
		    	
		    	// check if node is in the EXCLUSION list
		    	if(arrIsUnique(sig.device_name, this.excludedDevs[ind]))
		    		node.setAttribute("class", "Node");
		    	else
		    		node.setAttribute("class", "Node_hidden");
		    	
		    	// mouse handlers
				node.addEventListener("mouseover", function(evt){
					_self.onNodeMouseOver(evt.target);
				});
				node.addEventListener("mouseout", function(evt){
					_self.onNodeMouseOut(evt.target);
				});
				node.addEventListener("click", function(evt){
					_self.onNodeClick(evt.target);
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
	
	// plot for mode 2 (adapted hive plot, one axis per device) 
	drawAxes2 : function (srcData, ind, originX, originY, w1, h1, w2, h2, angle1, angle2)
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

			var line, pathDefn;
			
			// axis for device
			pathDefn = "M " + x1 + " " + y1 + " L " + x2 + " " + y2; 
			line = document.createElementNS(this.svgNS,"path");
			line.setAttribute("data-src", dev.name);
			line.setAttribute("d", pathDefn);
			line.setAttribute("class", "hive_axis");
			line.setAttribute("data-src", dev.name);
			this.deviceLines.push(line);
			this.svg.appendChild(line);
			
			// invisible axis for easier mouseover
			pathDefn = "M " + x1 + " " + y1 + " L " + x2 + " " + y2; 
			line = document.createElementNS(this.svgNS,"path");
			line.setAttribute("data-src", dev.name);
			line.setAttribute("d", pathDefn);
			line.setAttribute("class", "hive_axis_forMouseOver");
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
		    
		    // for each signal
		    for (var j=0; j<m; j++)
			{
		    	var sig = sigs[j];
		    	var pt = line.getPointAtLength( (j*lineInc) + padding);
		    	var node = document.createElementNS(this.svgNS,"circle");
		    	node.setAttribute("data-src", dev.name);
		    	node.setAttribute("data-srcSignal", sig.name);
		    	node.setAttribute("data-ind", ind);
		    	node.setAttribute("cx", pt.x);
		    	node.setAttribute("cy", pt.y);
		    	node.setAttribute("r", 5);
		    	node.setAttribute("style", "fill: " + this.groupColors[this.pColors[ind]] );
		    	
		    	if(arrIsUnique(sig.device_name, this.excludedDevs[ind]))
		    		node.setAttribute("class", "Node");
		    	else
		    		node.setAttribute("class", "Node_hidden");
		    	
		    	
		    	// mouse event handlers
		    	node.addEventListener("mouseover", function(evt){
					_self.onNodeMouseOver(evt.target);
				});
				node.addEventListener("mouseout", function(evt){
					_self.onNodeMouseOut(evt.target);
				});
				node.addEventListener("click", function(evt){
					_self.onNodeClick(evt.target);
				});
		    	
				this.sigs[ind].push(sig);
				this.nodes[ind].push(node);
			}
		    
		    this.setNextColor(ind);
		}
	},
	
	// draw all connections as lines connecting from source node to destination node
	drawConnections : function()
	{
		var _self = this;
		
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
					line.setAttribute("data-fullname", s.device_name + s.name + ">" + d.device_name + d.name);
					if(this.mode == 1){
						line.setAttribute("marker-start" , "url(#hive_connectionMarker)");
						line.setAttribute("marker-end" , "url(#hive_connectionMarker)");
					}
//					line.setAttribute("d", "M " + x1 + " " + y1 + " L " + x2 + " " + y2);
					line.setAttribute("d", "M " + x1 + " " + y1 + " Q " + ctX1 + " " + ctY1 + " " + x2 + " " + y2);
					if( arrIsUnique(s.device_name, this.excludedDevs[0]) && arrIsUnique(d.device_name, this.excludedDevs[1]))
						line.setAttribute("class", "hive_connection");
					else
						line.setAttribute("class", "hive_connection_hidden");
					
					line.addEventListener("mouseover", function(evt){
						this.classList.add("hive_connection_over");
					});
					line.addEventListener("mouseout", function(evt){
						this.classList.remove("hive_connection_over");
					});
					line.addEventListener("click", function(evt){
						_self.onConnectionClick(this) ;
					});
					
					if(this.selectedConnections_getIndex(line.getAttribute("data-fullname")) != -1)
					{
						line.classList.add("hive_connection_selected");
					}
					
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
			var n = this.nodes[0][i];
			if(this.selectedCells_getCellIndex(n, 0) > -1)
				n.classList.add('Node_selected');
			this.svg.appendChild(n);
		}
		for(var i=0; i< this.nodes[1].length; i++){
			var n = this.nodes[1][i];
			if(this.selectedCells_getCellIndex(n, 1) > -1)
				n.classList.add('Node_selected');
			this.svg.appendChild(n);
		}
	},
	
	// handler for mouse over of a device in the devices list
	onDevMouseOver : function(devName)
	{
		for (var i=0; i<this.deviceLines.length; i++)
		{
			var line = this.deviceLines[i];
			if(line.getAttribute("data-src") == devName)
			{
				line.setAttribute("class", "hive_axis_over");
			}
		}
		for (var i=0; i<this.connectionsLines.length; i++)
		{
			var con = this.connectionsLines[i];
			if(con.getAttribute("data-src") == devName ||  con.getAttribute("data-dst") == devName )
			{
				con.setAttribute("class", "hive_connection_over");
			}
			if(this.selectedConnections_getIndex(con.getAttribute("data-fullname")) != -1)
			{
				con.classList.add("hive_connection_selected");
			}
		}
	},
	
	// handler for mouse out of a device (in devices list or plot)
	onDevMouseOut : function(devName)
	{
		for (var i=0; i<this.deviceLines.length; i++)
		{
			var line = this.deviceLines[i];
			line.setAttribute("class", "hive_axis");
		}
		for (var i=0; i<this.connectionsLines.length; i++)
		{
			var con = this.connectionsLines[i];
			if(con.getAttribute("data-src") == devName || con.getAttribute("data-dst") == devName ){
				if(arrIsUnique(con.getAttribute("data-src"), this.excludedDevs[0]) && arrIsUnique(con.getAttribute("data-dst"), this.excludedDevs[1]) )
					con.setAttribute("class", "hive_connection");
				else
					con.setAttribute("class", "hive_connection_hidden");
				
				if(this.selectedConnections_getIndex(con.getAttribute("data-fullname")) != -1)
				{
					con.classList.add("hive_connection_selected");
				}
			}
		}
	},
	
	// handler for mouse over of a signal (in devices list or plot)
	onNodeMouseOver : function(node)
	{
		// set mouseover style of node
		var ind = node.getAttribute("data-ind");
		for (var i=0; i<this.nodes[ind].length; i++)
		{
			var node2 = this.nodes[ind][i];
			if(node.getAttribute("data-src") == node2.getAttribute("data-src") && node.getAttribute("data-srcSignal") == node2.getAttribute("data-srcSignal"))
				node2.classList.add("hive_node_over");
		}
		
		// set mouseover style of connection
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
				if(this.selectedConnections_getIndex(con.getAttribute("data-fullname")) != -1)
				{
					con.classList.add("hive_connection_selected");
				}
			}
		}
	},
	
	//handler for mouse out of a signal (in devices list or plot)
	onNodeMouseOut : function(node)
	{
		// set mouseover style of node
		var ind = node.getAttribute("data-ind");
		for (var i=0; i<this.nodes[ind].length; i++)
		{
			var node2 = this.nodes[ind][i];
			node2.classList.remove("hive_node_over");
			if(this.selectedCells_getCellIndex(node2, ind) > -1)
				node2.classList.add('Node_selected');
		}
		
		// set mouseover style of connection
		for (var i=0; i<this.connectionsLines.length; i++)
		{
			var con = this.connectionsLines[i];
			if(arrIsUnique(con.getAttribute("data-src"), this.excludedDevs[0]) && arrIsUnique(con.getAttribute("data-dst"), this.excludedDevs[1]))
				con.setAttribute("class", "hive_connection");
			else
				con.setAttribute("class", "hive_connection_hidden");
			
			if(this.selectedConnections_getIndex(con.getAttribute("data-fullname")) != -1)
			{
				con.classList.add("hive_connection_selected");
			}
		}
	},
	
	//functions used for sorting alphabetically
	compareDeviceLabel : function (devA, devB) 
	{
		var a = devA.name.toUpperCase();
		var b = devB.name.toUpperCase();
		return a.localeCompare(b);
	},
	compareSignalLabel : function (devA, devB) 
	{
		var a = devA.device_name.toUpperCase() + devA.name.toUpperCase();
		var b = devB.device_name.toUpperCase() + devB.name.toUpperCase();
		return a.localeCompare(b);
	},
	
	// show all devices in view
	includeAllDevices : function ()
	{
		this.excludedDevs = [[],[]]; 
	},
	
	// hide all devices in view
	excludeAllDevices : function ()
	{
		this.excludedDevs = [[],[]]; 
		
		//divide devices into sources and destinations
		var keys = this.model.devices.keys();
		for (var d in keys) 
		{
			var dev = this.model.devices.get(keys[d]);
			if(dev.n_outputs)
				this.excludedDevs[0].push(dev.name);
			if(dev.n_inputs)
				this.excludedDevs[1].push(dev.name);
		}
	},
	
	// collapse all nodes in the list of devices
	collapseAllDevices : function ()
	{
		this.expandedDevices = [[],[]]; 
	},
	
	// expand all nodes in the list of devices
	expandAllDevices : function ()
	{
		this.expandedDevices = [[],[]]; 
		
		//divide devices into sources and destinations
		var keys = this.model.devices.keys();
		for (var d in keys) 
		{
			var dev = this.model.devices.get(keys[d]);
			if(dev.n_outputs)
				this.expandedDevices[0].push(dev.name);
			if(dev.n_inputs)
				this.expandedDevices[1].push(dev.name);
		}
	},
	
	// methods for storing selected nodes
	onNodeClick : function(node)
	{
		this.selectedConnections_clearAll();	// nodes and connections can't be selected at the same time
		
		var ind = node.getAttribute("data-ind");
		
		// if COMMAND key is pressed, user is adding/removing to selection
		
		//if(e.metaKey)	// COMMAND key on MAC, CONTROL key on PC
		if(false)	// disabling selecting multiple nodes for now
		{
			if(this.selectedCells_getCellIndex(node, ind) == -1)	// not already selected
				this.selectedCells_addCell(node, ind);
			else
				this.selectedCells_removeCell(node, ind);
		}
		
		// if COMMAND is not pressed, then user is selecting a single cell
		
		else
		{
			if(this.selectedCells[ind].length == 1)		// case: one selected cell
			{
				if(this.selectedCells_getCellIndex(node, ind) == -1)	// not already selected, so select
				{
					this.selectedCells_clearAll(ind);
					this.selectedCells_addCell(node, ind);
				}
				else									// already selected, so remove
					this.selectedCells_clearAll(ind);					
			}
			else	// case: eith zero or many, so clear all and set the current
			{
				this.selectedCells_clearAll(ind);
				this.selectedCells_addCell(node, ind);
			}
		}

		// if there's a connection, select is also
		if(this.selectedCells[0].length == 1 && this.selectedCells[1].length == 1){
			
			var src = this.selectedCells[0][0].getAttribute("data-src") + this.selectedCells[0][0].getAttribute("data-srcSignal");
			var dst = this.selectedCells[1][0].getAttribute("data-src") + this.selectedCells[1][0].getAttribute("data-srcSignal");
			if(this.model.isConnected(src, dst))
			{
				this.selectedConnections.push(src+">"+dst);
			}
		}
		this.update_display();
		
	},
	
	selectedCells_addCell : function(cell, ind){
		cell.classList.add('Node_selected');			
		this.selectedCells[ind].push(cell);
	},
	selectedCells_removeCell : function(cell, ind){
		var index = this.selectedCells_getCellIndex(cell, ind);
		if(index > -1){
			cell.classList.remove('Node_selected');
			this.selectedCells[ind].splice(index, 1);				
		}
	},
	selectedCells_getCellIndex : function (cell, ind){
		var index = -1;
		var fullname = cell.getAttribute("data-src") + cell.getAttribute("data-srcSignal"); 
		for(var i=0; i<this.selectedCells[ind].length; i++)
		{
			var cell2 = this.selectedCells[ind][i]; 
			var name = cell2.getAttribute("data-src") + cell2.getAttribute("data-srcSignal");
			if (fullname == name)
			{
				index = i;
				break;
			}
		}
		return index;
	},
	selectedCells_clearAll : function (ind)
	{
		for(var i=0; i<this.selectedCells[ind].length; i++)
		{
			var n = this.selectedCells[ind][i]; 
			n.classList.remove('Node_selected');
		}
		this.selectedCells[ind] = [];	//clears the array
	},
	// END methods for storing selected nodes
	
	// methods for storing selected connections
	onConnectionClick : function(con)
	{
		
		this.selectedCells_clearAll(0);
		this.selectedCells_clearAll(1);
		
		var name = con.getAttribute("data-fullname");
		
		if(arrIsUnique(name, this.selectedConnections))
		{
			this.selectedConnections_clearAll();
			this.selectedConnections.push(name);
			
			// select corresponding nodes as well
			var fakeSrc = document.createElement("p");
			fakeSrc.setAttribute("data-src", con.getAttribute("data-src"));
			fakeSrc.setAttribute("data-srcSignal", con.getAttribute("data-srcSignal"));
			this.selectedCells_addCell(fakeSrc, 0);
			
			var fakeDst = document.createElement("p");
			fakeDst.setAttribute("data-src", con.getAttribute("data-dst"));
			fakeDst.setAttribute("data-srcSignal", con.getAttribute("data-dstSignal"));
			this.selectedCells_addCell(fakeDst, 1);
			
			con.classList.add("hive_connection_selected");
		}
		else{
			this.selectedConnections_clearAll();
		}
		
		
		this.update_display();
		update_connection_properties();
	},
	selectedConnections_clearAll : function ()
	{
		this.selectedConnections = [];
	},
	selectedConnections_getIndex : function (fullname)
	{
		var index = -1;
		for(var i=0; i<this.selectedConnections.length; i++)
		{
			var con2 = this.selectedConnections[i]; 
			if (fullname == con2)
			{
				index = i;
				break;
			}
		}
		return index;
	},
	// END methods for storing selected connections
	
	// create a new connection
	connect : function()
	{
		if(this.selectedCells[0].length == 0 || this.selectedCells[1].length == 0 )	
			return;
		
		for (var i=0; i<this.selectedCells[0].length; i++)
		{
			var s = this.selectedCells[0][i];
			var srcDev = s.getAttribute("data-src");
			var srcSig = s.getAttribute("data-srcSignal");
			
			for (var j=0; j<this.selectedCells[1].length; j++)
			{
				var d = this.selectedCells[1][j];
				var dstDev = d.getAttribute("data-src");
				var dstSig = d.getAttribute("data-srcSignal");
				
				if(this.model.isLinked(srcDev, dstDev) == false)				// devices must be linked before a connection can be made
					$(this._container).trigger("link", [srcDev, dstDev]);		// trigger link event
				$(this._container).trigger("connect", [srcDev+srcSig, dstDev+dstSig]);	// trigger connect event
				this.selectedConnections.push(srcDev+srcSig+">"+dstDev+dstSig);
			}
		}
		this.update_display();
	},

	// remove an existing connection
	disconnect : function (e)
	{
		if(this.selectedConnections.length == 0)
			return;
		
		var con = this.selectedConnections[0].split(">");
		var src = con[0];
		var dst = con[1];
		//var src = con.getAttribute("data-src") + con.getAttribute("data-srcSignal"); 
		//var dst = con.getAttribute("data-dst") + con.getAttribute("data-dstSignal");
		
		if(this.model.isConnected(src, dst) == true)
			$(this._container).trigger("disconnect", [src, dst]);	// trigger disconnect event
		
		this.selectedConnections_clearAll();
	},
	
	// toggle a connection
	toggleConnection : function ()
	{
		// need to have a selected src and dst
		if(this.selectedCells[0].length != 1 || this.selectedCells[1].length != 1 )
			return;
			
		if(this.selectedConnections.length == 1)
			this.disconnect();
		else
			this.connect();
				
	},
	
	// for cycling between view modes
	switchMode : function ()
	{
		this.mode++;
		if(this.mode == 2)
			this.mode = 0;
		this.update_display();
	},
	
	// for setting a specific view mode
	switchView : function (mode)
	{
		if(this.mode != mode)
		{
			this.mode = mode;
			this.update_display();
		}
	},
	
	// when browser window gets resized
	on_resize : function ()
	{
		var w = $(this._container).width();
		var h = $(this._container).height();
		this.svgDim[0] = w - this.inclusionTableWidth;
		this.svgDim[1] = h - this.actionBarHeight;
		this.init();
	},
	
	// returns to the main view the view-specific varibles before switching to another view
	save_view_settings : function ()
	{
		var data = [];
		data.push(this.excludedDevs);		// 0
		data.push(this.mode);				// 1
		data.push(this.expandedDevices);	// 2
		data.push(this.filters);			// 3
		return data;
	},
	
	// reloads from the main view the view-specific varibles we stored previously 
	load_view_settings : function (data)
	{
		this.excludedDevs = data[0];		
		this.mode = data[1];				
		this.expandedDevices = data[2];
		this.filters = data[3];
		
		this.update_display();
	},
	
	
	// returns to the main view an assoc containing the selected connection
	get_selected_connections: function(list)
	{
		var vals =[];
		
		if(this.selectedConnections.length > 0)
		{
			var con = this.selectedConnections[0].split(">");
			var src = con[0];
			var dst = con[1];
			if(this.model.isConnected(src, dst))
				vals.push(this.model.getConnection(src, dst));
		}	
		return vals;
	},

	//returns to the main view an assoc containing the devices included in view (all of them)
	get_focused_devices : function()
	{
		return this.model.devices;
	},
	
	// called to update data and redraw everything
	update_display : function ()
	{
		this.init();
	},
	
	cleanup : function ()
	{
		document.onkeydown = null;
	}
};

// not used yet
function HiveViewPreset(name, data)
{
	this.name = name;
	this.excludedDevs = data[0];		
	this.mode = data[1];				
	this.expandedDevices = data[2];
};
