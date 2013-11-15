//+++++++++++++++++++++++++++++++++++++++++++ //
//		  	     Grid View Class		  	  //		 
//+++++++++++++++++++++++++++++++++++++++++++ //

function BalloonView(container, model)
{
	var _self = this;
	
	this.svgNS = "http://www.w3.org/2000/svg";
	this.svgNSxlink = "http://www.w3.org/1999/xlink";

	this._container = container;
	this.model = model;
	
	this.svg;					// holding <SVG> elements for easy reference
	this.svgDim = [800, 600]; 	// x-y dimensions of the svg canvas
	this.nodeRadius = 40;
	this.tableWidth = 200;
	
	//this.devs;					// to hold libmapper devices
	//this.devTrees = [[],[]];	// to hold balloon trees for each device
	
	this.trees = [null, null];
	this.viewNodes = [null, null];
	this.tables = [null, null];
	this.rootLabel = ["Sources", "Destinations"];
	this.maxViewDepth = 15;
	
	// drag variables
	this.dragSource = null;
	this.dragTarget = null;
	this.dragLine = null;
	this.dragSourceX = 0;
	this.dragSourceY = 0;
	this.dragMouseX = 0;
	this.dragMouseY = 0;
	//this.ctX1 =  this.svgDim[0]/2;
	//this.ctY1 =  this.svgDim[1]/2;
	this.ctX1 =  300;
	this.ctY1 =  300;
	
	//Keyboard handlers
	$('body').on('keydown.balloon', function(e){
		_self.keyboardHandler(e);
	});
	this.selectedConnections = [];
		
}

BalloonView.prototype = {
	
	/**
	 * Initialize the view
	 * Creates container DIVs for the accordions
	 * Creates the SVG canvas
	 */
	init : function () 
	{ 
		var _self = this;				// to pass to the instance of balloon.js to event handlers
		var wrapperDiv, div, btn;		// to instantiate items
		
		// clear the container DIV
		$(this._container).empty();
		
		// create the wrapper DIV
		wrapperDiv = document.createElement("div");
		wrapperDiv.setAttribute("id", "balloonWrapper");
		this._container.appendChild(wrapperDiv);
		
		// add source table DIV
		this.tables[0] = document.createElement("div");
		this.tables[0].setAttribute("id", "balloonTable_src");
		this.tables[0].setAttribute("class", "balloonTable");
		this.tables[0].setAttribute("style", "width: " + this.tableWidth + "px; height: " + this.svgDim[1] + "px;");
		wrapperDiv.appendChild(this.tables[0]);
		
		// add SVG canvas
		this.svg = document.createElementNS(this.svgNS,"svg");
		this.svg.setAttribute("id", "BalloonSVG");
		this.svg.setAttribute("xmlns", this.svgNS);
		this.svg.setAttribute("xmlns:xlink", this.svgNSxlink);
		this.svg.setAttribute("width", this.svgDim[0]);
		this.svg.setAttribute("height", this.svgDim[1]);
		this.svg.setAttribute("style", "float:left;margin: 0 auto;");
		this.svg.addEventListener("click", function(evt){
			_self.clearSelectedConnections();
		});
		wrapperDiv.appendChild(this.svg);	
		
		// add destination table DIV
		this.tables[1] = document.createElement("div");
		this.tables[1].setAttribute("id", "balloonTable_dst");
		this.tables[1].setAttribute("class", "balloonTable");
		this.tables[1].setAttribute("style", "width: " + this.tableWidth + "px; height: " + this.svgDim[1] + "px;");
		wrapperDiv.appendChild(this.tables[1]);
		
		//create the SVG texture
		this.initTextures();
		
		this.refreshData();
		this.on_resize();
		this.createTables();
	},
	
	keyboardHandler : function (e)
	{
		console.log(e.which);
		
		// 'delete' to remove a connection
		if (e.which == 46 || e.which == 8)  // disconnect on 'delete'
		{
			e.preventDefault();
			var n = this.model.selectedConnections.length();
			if(n > 0)
			{
				var keys = this.model.selectedConnections.keys();
				for(i=0; i<keys.length; i++)
				{
					var conn = this.model.selectedConnections.get(keys[i]);
					var src = conn.src_name;
					var dst = conn.dest_name;
					if(this.model.isConnected(src, dst) == true){
						$(this._container).trigger("disconnect", [src, dst]);	// trigger disconnect event
						this.model.selectedConnections.remove(keys[i]);
					}
				}
			}
			$(this._container).trigger("updateConnectionProperties");	// tell main to update edit bar
			this.refreshSVG();
		}
		
	},
	
	get_selected_connections: function (list)
	{
		var vals = [];
		var keys = this.model.selectedConnections.keys(); 
		for(var i=0; i<keys.length; i++){
			vals.push(this.model.connections.get(keys[i]));
		}
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
	
	save_view_settings : function ()
	{
		var data = [];
		data.push(this.viewNodes);						// 0
		data.push(this.model.selectedConnections);		// 1
		return data;
		
	},
	
	load_view_settings : function (data)
	{
		this.viewNodes = data[0];
		this.model.selectedConnections = data[1];
	},
	
	/**
	 * Called when the window resizes to update the dimension of the tables and SVG
	 */
	on_resize : function ()
	{
		// get the new window size
		var w = $(this._container).width();
		var h = $(this._container).height();
		
		// set the new SVG dimensions 
		this.svgDim[0] = w - this.tableWidth*2;
		this.svgDim[1] = h;
		
		// update the GUI elements
		this.tables[0].setAttribute("style", "width: " + this.tableWidth + "px; height: " + this.svgDim[1] + "px;");
		this.tables[1].setAttribute("style", "width: " + this.tableWidth + "px; height: " + this.svgDim[1] + "px;");
		
		this.svg.setAttribute("width", this.svgDim[0]);
		this.svg.setAttribute("height", this.svgDim[1]);
		this.refreshSVG();
	},
	
	cleanup : function ()
	{
		$(this._container).off('.balloon');
	},
	
	/**
	 * Draws the SVG container elements
	 */
	drawCanvas : function ()
	{
		var obj;
		var _self = this;
		
		// source exterior
		if(this.viewNodes[0].level >= 0)
		{
			obj = document.createElementNS(this.svgNS,"rect");
			obj.setAttribute("x", 0);		
			obj.setAttribute("width", this.svgDim[0]/2);		
			obj.setAttribute("height", this.svgDim[1]);			
			obj.setAttribute("class", "BalloonCorner");
			obj.addEventListener("click", function(evt){
				evt.stopPropagation(); //prevents click reaching canvas and deselecting
				_self.onBackClick(0);
			});
			this.svg.appendChild(obj);
		}

		// destination exterior
		if(this.viewNodes[1].level >= 0)
		{
			obj = document.createElementNS(this.svgNS,"rect");
			obj.setAttribute("x", this.svgDim[0]/2);		
			obj.setAttribute("width", this.svgDim[0]/2);		
			obj.setAttribute("height", this.svgDim[1]);			
			obj.setAttribute("class", "BalloonCorner");
			obj.addEventListener("click", function(evt){
				evt.stopPropagation(); //prevents click reaching canvas and deselecting
				_self.onBackClick(1);
			});
			this.svg.appendChild(obj);
		}
		
		// cutout the middle with a white ellipse
		obj = document.createElementNS(this.svgNS,"ellipse");
		var w = this.svgDim[0]/2 + 1 - 10;
		var h = this.svgDim[1]/2 + 1 + 10;
		obj.setAttribute("cx", this.svgDim[0]/2);		
		obj.setAttribute("cy", this.svgDim[1]/2);		
		obj.setAttribute("rx", w);						
		obj.setAttribute("ry", h);						
		obj.setAttribute("fill", "#fff");
		this.svg.appendChild(obj);
	},
	
	/*
	 * 
	 * 
	 */
	/**
	 * Aaron's magic formula for determining largest possible circle to fill the container circle's space
	 * sometimes the circles overlap because the container is an ellipse and the formula is actually for circles
	 * @param n number of nodes to fit
	 * @param containerR radius of containing circle (if ellipse, choose the smaller dimension to minimize overlap)
	 */
	calculateR : function (n, containerR, padding)
	{
		var r = 1 / ( 1 / Math.sin( Math.PI / (2*n) ) + 1 );	
		return r * (containerR * padding);							
	},
	
	/**
	 * Given a set of nodes, calculates the size and position to plot them in the SVG canvas
	 * Nodes are separated with sources on the left and destinations on the right
	 * Radius is determined by Aaron's magical formula to calculate the largest possible circles that will fit inside the container ellipse
	 * 
	 * @param ind source or destination
	 * @param nodes the set of nodes to draw
	 * @param origin origin of the containing ellipse [x,y]
	 * @param dim radius of containing ellipse [rx, ry]
	 */
	drawNodes : function (ind, nodes, origin, dim)
	{
		// number of nodes
		var n = nodes.length;
		var r = this.calculateR(n, Math.min(this.svgDim[1], this.svgDim[0])/2, 0.9);

		// calculate angles
		var angleFrom = 0 * Math.PI / 180;		// start angle		
		var angleTo = 180 * Math.PI / 180;		// end angle
		var range = angleTo - angleFrom;		// total arc size
		var angleInc = (n==1)? 0 : range/(n);	// angle to increment on each step
		var angleFromOffset = (ind==0)? Math.PI/2 : - Math.PI/2;	// offset sources and destinations to their respective sides
		if (n==1) angleFromOffset += Math.PI/2;	// special case, if only one node then place it in the center
		
		//  plot helpers
		var w = dim[0] - r - 75 ;		// container ellipse width minus radius of node with extra padding
		var h = dim[1] - r ;		// container ellipse height minus radius of node with extra padding
		if(ind==0)	h = -h;
		var positionOffset = (ind==0)?  -this.nodeRadius-10 : this.nodeRadius+10;
		
		// draw the nodes
		for(var i=0; i<n; i++)
		{
			var node = nodes[i];
			var nAngle = angleFrom + angleInc/2 + angleFromOffset + (i*angleInc);
			var x = ( w * Math.cos(nAngle) ) + origin[0] + positionOffset;
			var y = ( h * Math.sin(nAngle) ) + origin[1];
			this.drawNode(node, ind, x, y, i, r);
		}
	},
	
	/**
	 * Draws a single node given the parameters from the arc plotter in the drawNodes() function 
	 * 
	 * @param node the BalloonNode
	 * @param ind source or destination
	 * @param x horizontal center of the circle
	 * @param y vertical center of the circle
	 * @param childIndex index into array
	 * @param radius radius of circle
	 */
	drawNode : function (node, ind, x, y, childIndex, radius)
	{
		var _self = this;
		var stylename;
		
		// create the SVG element 
		node.svg = document.createElementNS(this.svgNS,"circle");
		node.svg.setAttribute("cx", x);						// x-position
		node.svg.setAttribute("cy", y);						// y-position
		node.svg.setAttribute("data-ind", ind);				// src or destination
		node.svg.setAttribute("data-childIndex", childIndex);	// index into the container array
		node.svg.setAttribute("r", radius);			// radius of circle
		$(node.svg).data("node", node);
		
		// tooltip
		$(node.svg).qtip({
		    content: {
		        text: node.label
		    },
		    position: {
		        target: 'mouse',
		        adjust: {
		            mouse: true,
	                x: 10,
	                y: -15
		        }
		    },
		    style: { classes: 'qTipStyle' }
		});
		
		if(node.isLeaf())									// for terminal node
		{
			stylename = "BalloonLeafNode";
			
			// drag and drop functionality for leaves only
			node.svg.addEventListener("mousedown", function(evt){ _self.dragStart(evt);	});
			node.svg.classList.add("dragable");
		}
		else												// for non-terminal node
		{
			stylename = "BalloonNode";
			
			// mouse handlers
			node.svg.addEventListener("mouseover", function(evt){ _self.onNodeMouseOver(evt);	});
			node.svg.addEventListener("mouseout", function(evt){ _self.onNodeMouseOut(evt);	});
			node.svg.addEventListener("click", function(evt){ _self.onNodeClick(evt); 	});
		}
		stylename += (ind==0)? "_src" : "_dst" ;
		node.svg.classList.add(stylename);
		this.svg.appendChild(node.svg);
		
		// recurse for children
		if(!node.isLeaf())									// for terminal node
		{
			this.drawChildNodes(ind, node, x, y, radius);
		}
	},
	
	drawChildNodes : function(ind, node, x, y, r)
	{
		// draw children nodes one level deep
		var n = node.childNodes.length;

		var angleInc =  (n==1)? 0 : (180 * Math.PI / 180) / (n);
		var offset = (ind==0)? Math.PI/2 : - Math.PI/2;
		
		var childNodeRadius = this.calculateR(n, r, 1);
		var childNodeRadiusPadded = childNodeRadius*0.9;	
		
		
		for(var i=0; i<n; i++)
		{
			var childNode = node.childNodes[i];
			var childStyle = (childNode.isLeaf()) ? "BalloonLeafNode": "BalloonNode";
			childStyle += (ind==0)? "_src" : "_dst" ;
			
			var nAngle = i*angleInc + offset + angleInc/2;
			if(n==1)
				nAngle += Math.PI/2;
			var x2 = ( (r-childNodeRadius) * Math.cos(nAngle) ) + x;
			var y2 = ( (r-childNodeRadius) * Math.sin(nAngle) ) + y;
			if(ind==0) y2 = ( -(r-childNodeRadius) * Math.sin(nAngle) ) + y;
			
			childNode.svg = document.createElementNS(this.svgNS,"circle");
			childNode.svg.setAttribute("cx", x2);						// x-position
			childNode.svg.setAttribute("cy", y2);						// y-position
			childNode.svg.setAttribute("data-ind", ind);				// src or destination
			childNode.svg.setAttribute("data-childIndex", n);	// index into the container array
			childNode.svg.setAttribute("r", childNodeRadiusPadded);
			childNode.svg.setAttribute("class", childStyle);
			$(childNode.svg).data("node", childNode);
			
			//childNode.svg.addEventListener("mouseover", function(evt){ _self.onChildNodeMouseOver(evt);	});
			//childNode.svg.addEventListener("mouseout", function(evt){ _self.onChildNodeMouseOut(evt);	});
			
			// drag and drop functionality for leaves only
			if(childNode.isLeaf()){
				childNode.svg.addEventListener("mousedown", function(evt){ _self.dragStart(evt);	});
				childNode.svg.classList.add("dragable");
			}
			
			// click functionality for branches
			else{
				childNode.svg.addEventListener("click", function(evt){ _self.onNodeClick(evt); 	});
			}
			
			// tooltip
			$(childNode.svg).qtip({ 
			    content: {
			        text: node.label + ' / ' + childNode.label
			    },
			    position: {
			        target: 'mouse',
			        adjust: {
			            mouse: true,
		                x: 10,
		                y: -15
			        }
			    },
			    style: { classes: 'qTipStyle' }
			});
			
			this.svg.appendChild(childNode.svg);
			
			if(childNode.level - this.viewNodes[ind].level < this.maxViewDepth){
				if(!childNode.isLeaf()){
					this.drawChildNodes(ind, childNode, x2, y2, childNodeRadiusPadded);
				}
			}
			
		}
	},
	
	/**
	 * Draws the connections between all terminal nodes
	 * 
	 * Connection = connection between leaf nodes
	 * Link = connection between nodes that have connected child nodes (not used currently)
	 */
	drawConnections : function()
	{
		// for each SOURCE node in the display
		for(var i=0; i<this.viewNodes[0].childNodes.length; i++)
		{
			var srcNode = this.viewNodes[0].childNodes[i];
			var descendantNodes = srcNode.getDescendantLeafNodes();
			
			for(var j=0; j<descendantNodes.length; j++)
			{
				var curNode = descendantNodes[j];
				var connections = curNode.getConnected(this.viewNodes[1].childNodes);

				for(var k=0; k<connections.length; k++)
				{
					this.drawConnection(curNode, connections[k]);
				}
			}
		}
		
	},
	
	/**
	 * creates the SVG element for a connection
	 * 
	 * @param src node
	 * @param dst node
	 */
	drawConnection : function(src, dst)
	{
		var ctX1 =  this.svgDim[0]/2;
		var ctY1 =  this.svgDim[1]/2;
		var x1,y1,x2,y2;

		x1 = src.svg.getAttribute("cx");	
		y1 = src.svg.getAttribute("cy");	
		x2 = dst.svg.getAttribute("cx");	
		y2 = dst.svg.getAttribute("cy");	

		// create the SVG line element to handle mouse interaction
		var line = document.createElementNS(this.svgNS,"path");
		line.setAttribute("d", "M " + x1 + " " + y1 + " Q " + ctX1 + " " + ctY1 + " " + x2 + " " + y2);
		line.setAttribute("class", "balloonConnectionHandler");
		$(line).data("srcNode", src);
		$(line).data("dstNode", dst);
		
		// create the SVG line element as the display object
		var line2 = document.createElementNS(this.svgNS,"path");
		line2.setAttribute("d", "M " + x1 + " " + y1 + " Q " + ctX1 + " " + ctY1 + " " + x2 + " " + y2);
		
		var c = model.connections.get(src.signalName + ">" + dst.signalName);
		if(c.muted)
			line2.setAttribute("class", "balloonConnection_muted");
		else
			line2.setAttribute("class", "balloonConnection");
		
		if(this.model.selectedConnections_isSelected(src.signalName, dst.signalName))
		{
			line2.classList.add("balloonConnection_selected");
		}
		
		line.addEventListener("mouseover", function(evt){
			var displayLine = $(this).data("displayObject");
			displayLine.classList.add("balloonConnection_over");
		});
		line.addEventListener("mouseout", function(evt){
			var displayLine = $(this).data("displayObject");
			displayLine.classList.remove("balloonConnection_over");
		});
		line.addEventListener("click", function(evt){
			evt.stopPropagation();
			_self.onConnectionClick(this) ;
		});
		
		
		$(line).data("displayObject", line2);
		
		this.svg.appendChild(line);
		this.svg.appendChild(line2);
	},
	

	/**
	 * Handles mouseover on a node in the SVG plot 
	 */
	onNodeMouseOver : function(evt)
	{
		evt.currentTarget.classList.add('BalloonNode_over');
	},
	
	/**
	 * Handles mouseout on a node in the SVG plot 
	 */
	onNodeMouseOut : function(evt)
	{
		evt.currentTarget.classList.remove('BalloonNode_over');
	},
	/**
	 * Handles mouseover on a child node in the SVG plot 
	 */
	onChildNodeMouseOver : function(evt)
	{
		var node = $(evt.currentTarget).data("node");
		node.parentNode.svg.classList.add('BalloonNode_over');
	},
	
	/**
	 * Handles mouseout on a node in the SVG plot 
	 */
	onChildNodeMouseOut : function(evt)
	{
		var node = $(evt.currentTarget).data("node");
		if(node)
			node.parentNode.svg.classList.remove('BalloonNode_over');
	},
	
	/**
	 * Handles clicking on a node in the SVG plot 
	 */
	onNodeClick : function(evt)
	{
		evt.stopPropagation(); //prevents click reaching canvas and deselecting
		var item = evt.currentTarget;
		var node = $(item).data("node");
//		var childIndex = node.childIndex;
		var ind = item.getAttribute("data-ind");
		this.viewNodes[ind] = node;
//		console.log(this.viewNodes[ind]);
		this.refreshSVG();
		this.updateTable(ind);
	},
	/**
	 * Handles clicking on a node in the SVG plot 
	 */
	onChildNodeClick : function(evt)
	{
		evt.stopPropagation(); //prevents click reaching canvas and deselecting
		var item = evt.currentTarget;
		var node = $(item).data("node").parentNode;
		var childIndex = node.childIndex;
		var ind = item.getAttribute("data-ind");
		this.viewNodes[ind] = this.viewNodes[ind].childNodes[childIndex];
		this.refreshSVG();
		this.updateTable(ind);
//		console.log("Child Clicked");
	},
	
	/**
	 * Handles clicking on a header in the accordion
	 */
	onListHeaderClick : function (evt, ui,ind)
	{
		// clear styles of headers an LI items
		$("#accordion" + ind).children('h3').each(function(){
			this.classList.remove("selected");
		});
		$("#accordion" + ind).find('li').each(function(){
			this.classList.remove("selected");
		});
		
		// get the clicked header
		var headerNode = $(ui.newHeader).data("node");
		
		// if clicked on a new tab header node will have a value
		if(headerNode)
		{
			// set the new view node
			this.viewNodes[ind] = headerNode;
			
			// update styles
			var headerNodeIndex = headerNode.childIndex;
			$("#accordion" + ind).find('h3').each(function(){
				var h3 = this;
				if( $(h3).data("node").childIndex == headerNodeIndex )
					h3.classList.add("selected");
			});
			
		}
		// headerNode is null means clicked on the already open tab 
		else
		{
			// if header's node is not in view, that means a child is in view
			// set the view to the header's node and prevent closing the tab
			if(this.viewNodes[ind].level > 0)
			{
				// set the view to the header node
				this.viewNodes[ind] = $(ui.oldHeader).data("node");
				
				// set the style of the header to selected
				$("#accordion" + ind).find('h3').each(function(){
					var h3 = this;
					if( $(h3).data("node").childIndex == $(ui.oldHeader).data("node").childIndex )
						h3.classList.add("selected");
				});
				
				// prevent the accordion from closing
				evt.stopImmediatePropagation();
	            evt.preventDefault();
			}
			
			// if header's node is in view, then close the tab and show root
			else
			{
				// set the new view node to the root
				this.viewNodes[ind] = this.trees[ind];
			}
		}
		
		// refresh the SVG
		this.refreshSVG();
	},
	
	/**
	 * Handles clicking on a namespace in the accordion's contents (<LI> items) 
	 */
	onListClick : function (evt)
	{
		var item = evt.currentTarget;
		var node = $(item).data("node");
		var ind = node.direction;
		if(node.isLeaf())
		{
			this.viewNodes[ind] = node.parentNode;
		}
		else
		{
			this.viewNodes[ind] = node;
		}
		this.refreshSVG();
		this.updateTable(ind);
	},

	/**
	 * Handles mouseover on a namespace in the accordion's contents (<LI> items) 
	 */
	onListOver : function (evt)
	{
		
	},
	
	/**
	 * Handles clicking to go up one level in the hierarchy 
	 */
	onBackClick : function (ind)
	{
		if(this.viewNodes[ind].parentNode != null)
		{
			this.viewNodes[ind] = this.viewNodes[ind].parentNode;
			this.refreshSVG();
			this.updateTable(ind);
		}
	},
	
	onConnectionClick : function (line)
	{
		var displayLine = $(line).data("displayObject");
		
		var srcNode = $(line).data("srcNode");
		var dstNode = $(line).data("dstNode");
		
		// is already selected
		if(displayLine.classList.contains("balloonConnection_selected"))
		{
			displayLine.classList.remove("balloonConnection_selected");
			this.model.selectedConnections_removeConnection(srcNode.signalName, dstNode.signalName);
		}
		else{
			displayLine.classList.add("balloonConnection_selected");
			this.model.selectedConnections_addConnection(srcNode.signalName, dstNode.signalName);
		}	
		
		$(this._container).trigger("updateConnectionProperties");	// tell main to update edit bar
		
	},

	clearSelectedConnections : function ()
	{
		this.model.selectedConnections_clearAll();
		$(this._container).trigger("updateConnectionProperties");	// tell main to update edit bar
		this.refreshSVG();
	},
	
	/**
	 * starts the dragging process for creating connections (mousedown on leaf node)
	 */
	dragStart : function (evt) 
	{
//		console.log("starting drag");
		var _self = this;

		// store the element clicked on
		this.dragSource = evt.target;	

		// init the mouse position variables
		this.dragSourceX = this.dragSource.getAttribute("cx");
		this.dragSourceY = this.dragSource.getAttribute("cy");

		var bounds = this.svg.getBoundingClientRect();
		this.dragMouseX = evt.clientX - bounds.left;
		this.dragMouseY = evt.clientY - bounds.top;
		
		// create the temporary drag line
		this.dragLine = document.createElementNS(this.svgNS,"path");
		this.dragLine.id = "balloonDragLine";
		this.dragLine.setAttribute("class", "dragLine");
		var pathString = "M " + this.dragSourceX + " " + this.dragSourceY + " L " + this.dragMouseX + " " + this.dragMouseY; 
		//dragLine.setAttribute("d", "M " + dragMouseX + " " + dragMouseY + " Q " + ctX1 + " " + ctY1 + " " + dragCurrentX + " " + dragCurrentY);
		this.dragLine.setAttribute("d", pathString);
		this.svg.appendChild(this.dragLine);
		
		// init event listeners to track the mouse
		$(window).bind("mousemove", {_self: _self}, this.drag);
		$(window).bind("mouseup", {_self: _self}, this.dragStop);
	  
	},

	/**
	 * handles dragging after drag has started (window mousemove)
	 * follows the mouse to draw a connection line from the drag source
	 * checks if the target is a leaf node and snaps the line
	 */
	drag : function (evt)
	{
		evt.data._self.dragTarget = null;
		
		var mouseTarget = document.elementFromPoint(evt.clientX, evt.clientY);
		if(mouseTarget && mouseTarget.classList.contains("dragable"))
		{
			var srcNode = $(evt.data._self.dragSource).data("node");
			var tgtNode =  $(mouseTarget).data("node");
			if(srcNode.direction != tgtNode.direction )
				evt.data._self.dragTarget = mouseTarget;
		}
		
		// if hovering over a terminal node, snap the line
		if(evt.data._self.dragTarget)
		{
			var x = mouseTarget.getAttribute("cx");
			var y = mouseTarget.getAttribute("cy");
			evt.data._self.dragMouseX = x - 1;
			evt.data._self.dragMouseY = y - 1;
		}
		else
		{
			var offset = evt.data._self.svg.getBoundingClientRect();
			evt.data._self.dragMouseX = evt.clientX - offset.left - 1;
			evt.data._self.dragMouseY = evt.clientY - offset.top - 1;
		}

		var pathString = "M " + evt.data._self.dragSourceX + " " + evt.data._self.dragSourceY + " L " + evt.data._self.dragMouseX + " " + evt.data._self.dragMouseY; 
		evt.data._self.dragLine.setAttribute("d", pathString);
	},

	/**
	 * handles mouseup from the window to stop the dragging process
	 * triggers the connect event if a src and dst are valid
	 */
	dragStop : function (evt)
	{
		var _this = evt.data._self;
//		console.log ("stop drag");
		if(_this.dragSource && _this.dragTarget)
		{
			var src = $(_this.dragSource).data("node");
			var dst = $(_this.dragTarget).data("node");
				
			// ensure proper direction for connecting
			if(src.direction == 0)
				_this.connect(src, dst);
			else
				_this.connect(dst, src);

			// send connect event
		}
		
		// delete the temporary line
		if(_this.svg.getElementById("balloonDragLine"))
			_this.svg.removeChild(_this.dragLine);
		
		// cleanup
		$(window).unbind("mousemove", _this.drag);
		$(window).unbind("mouseup", _this.dragStop);
		_this.dragSource = null;
		_this.dragTarget = null;
		_this.dragLine = null;
	},
	
	
	/**
	 * Function to create/add nodes into the tree given a signal namespace
	 * 
	 * @param namespaces an array with each namespace ('/' removed)
	 * @param currentNode the node to check (used in recursion)
	 * @param level used to set the level in the hierarchy
	 * @returns
	 */
	addSignal : function (deviceName, signalName, namespaces, currentNode, level, ind)
	{
		var label = namespaces[0];	
		var node, i;
		
		// check if a node exists with the same label
		for(i=0; i<currentNode.childNodes.length; i++)
		{
			var tempNode = currentNode.childNodes[i];
			if(tempNode.label == label)
			{
				// node exists, set pointer to it
				node = tempNode;
				break;
			}
		}
		// node doesn't exist, create it
		if(i==currentNode.childNodes.length)
		{
			node = new BalloonNode();
			node.label = namespaces[0];
			node.level = level;
			node.parentNode = currentNode;
			node.childIndex = i;
			node.direction = ind;
			node.deviceName = deviceName;
			node.signalName = signalName;
			currentNode.childNodes.push(node);
		}
		
		// recurse for next level or return 
		if(namespaces.length > 1)
		{
			namespaces.splice(0,1);					
			this.addSignal(deviceName, signalName, namespaces, node, level+1, ind);
		}
		else
			return;
	},
	
	/**
	 * prints out the list of nodes and all child nodes recursively
	 * returns an unordered list with the hierarchy
	 */
	print : function (node, level)
	{
		var _self = this;
		var ul; 

		if(level != 0)
		{
			ul = document.createElement("ul");
			
			// create a LI for the node
			var li = document.createElement("li");
			li.innerHTML = node.label;
			$(li).data("node", node);
			li.addEventListener("click", function(evt){ 
				_self.onListClick(evt); 	
			});
			ul.appendChild(li);
		}
		else
			ul = document.createElement("div");
		
		// recursively create an UL for its children
		var n = node.childNodes.length;
		if(n>0)
		{
			for(var i=0; i<n; i++)
				ul.appendChild(this.print(node.childNodes[i], level+1));
		}

		return ul;
	},
	
	/**
	 * Prints the trail of parent node labels recursively
	 * used for breadcumbs of current position in the hierarchy
	 */
	printBreadCrumbs : function (ind, node)
	{
		var result = node.label;
		
		if(node.parentNode != null){
			result = this.printBreadCrumbs(ind, node.parentNode) + "<br />" + result;
		}
		
		return result;
	},
	
	update_display : function ()
	{
		this.refreshData();
		this.refreshSVG();
		this.createTables();
	},
	
	/**
	 * Recreates the balloon tree data structure
	 * to be used when view initializes or model is updated with new devices/signals
	 */
	refreshData : function ()
	{
		if(this.trees[0])
			this.trees[0].deleteNode();
		if(this.trees[1])
			this.trees[1].deleteNode();
		
		// create root node for the source/destination trees
		for(var i=0; i<2; i++)
		{
			var tree = new BalloonNode();
			tree.parentNode = null;
			tree.label = this.rootLabel[i];
			this.signalName = this.rootLabel[i];
			tree.level = -1;
			tree.direction = i;
			this.trees[i] = tree;
		}
		
		// ensure all signals are loaded into the model
		var keys = this.model.devices.keys();
		for (var d in keys) 
		{
			var k = keys[d];
			var dev = this.model.devices.get(k);
			$(this._container).trigger("getSignalsByDevice", dev.name);
			$(this._container).trigger("get_links_or_connections_by_device_name", dev.name);
		}
		
		var keys = this.model.signals.keys();
	    for (var i=0; i<keys.length; i++) 
	    {
	    	var sig = this.model.signals.get(keys[i]);
	    	var devName = sig.device_name;
	        var sigName = sig.device_name + sig.name;
	        var namespaces = sigName.split("/").filter(function(e) { return e; });// splits and removes empty strings
	        this.addSignal(devName, sigName, namespaces, this.trees[1-sig.direction], 0, 1-sig.direction);	// FIX sig.direction will become an ENUM constant
	    }
	
	    // if view level is not set by user, set it to the root
	    for(var i=0; i<2; i++)
    	{
	    	if(this.viewNodes[i] != null)
	    	{
	    		var newNode = this.trees[i].getNode(this.viewNodes[i]);
	    		if(newNode)
	    			this.viewNodes[i] = newNode;
	    		else
	    			this.viewNodes[i] = this.trees[i];
	    	}	
	    	else
	    		this.viewNodes[i] = this.trees[i];
	    		
    	}
	},
	
	/**
	 * Wrapper to recreate both tables with the accordion lists
	 */
	createTables : function ()
	{
		this.createTable(0);
		this.createTable(1);
	},
	
	/**
	 * Creates a JQuery UI accordion with the namespaces
	 * The acordion headers correspond to devices (the first element of the namespace)
	 * A hierarchichal list is created for each device
	 */
	createTable : function (ind)
	{
		var _self = this;
		var accordion, btn;
		
		// empty the DIV contents
		$(this.tables[ind]).empty();

		/*
		// navigation button
		btn = document.createElement("button");
		btn.innerHTML = "Back";
		btn.title = "Go Up a level";
		btn.addEventListener("click", function(evt){ 
			_self.onBackClick(ind); 
		});
		this.tables[ind].appendChild(btn);
		*/
		
		/*
		// print the heirarchy trail 
    	var p = document.createElement("p");
    	p.innerHTML = this.printBreadCrumbs(ind, this.viewNodes[ind]);
    	this.tables[ind].appendChild(p);
		*/
		
		// create the accordion object
    	accordion = document.createElement("div");
    	accordion.id = "accordion" + ind;
    	for(var i=0; i<this.trees[ind].childNodes.length; i++)
		{
    		var node = this.trees[ind].childNodes[i];
    		
    		// create the heading
    		var heading = document.createElement("h3");
    		heading.innerHTML = node.label;
    		$(heading).data("node", node);
    		accordion.appendChild(heading);
    		
    		// create the list of namespaces
    		var content = document.createElement("div");
    		content.appendChild(this.print(node, 0)); // recursive function
    		accordion.appendChild(content);

		}
    	this.tables[ind].appendChild(accordion);

    	// initialize the JQuery UI accordion
    	$( "#accordion" + ind ).accordion({
    		heightStyle: "content",
    		collapsible: true,
    		active: 'none',
    		beforeActivate: function( event, ui ) {
				_self.onListHeaderClick(event, ui, ind);    			
    		}
    	});
    	
    	// expand the device in view
    	this.updateTable(ind);
	},
	
	/**
	 * Used to UPDATE the accordion's active container and selected styles
	 */
	updateTable : function (ind)
	{
		_self = this;
		var index = null; 	// index of node->accordion to expand
		
		// the node currently in view in the SVG plot
		var node = this.viewNodes[ind];

		// clear all header selected styles
		$("#accordion" + ind).children('h3').each(function(){
			this.classList.remove("selected");
		});

		// if node is root, collapse all accordion items
		if(node.level == -1)
		{
			$("#accordion" + ind).accordion("option", "active", false);
		}
		
		// if not root, find the correct accordion header to expand
		else
		{
			// recursively find the node pertaining to the signal's device
			// this node will have a child index corresponding also to its position in the accordion list
			while (node.parentNode != null) 
			{
				// if node is the direct child of the root, then note its index
				if(node.level == 0){
					index = node.childIndex;
					break;
				}
				// else recurse to the next upper level
				else
					node = node.parentNode;
			}
			
			// open the accordion to the corresponding index
			$("#accordion" + ind).accordion("option", "active", index);

			// find the item currently in view and set its style
			
			// if header is in view
			if(this.viewNodes[ind].level == 0)
			{
				$("#accordion" + ind).children('h3').each(function(){
					var h3Node = this;
					if( $(h3Node).data("node").childIndex == index )
						h3Node.classList.add("selected");
					else
						h3Node.classList.remove("selected");
				});
			}
			
			$("#accordion" + ind).find('li').each(function(){
				var li = this;
				var liNode = $(li).data("node");
				
				if(liNode.equals(_self.viewNodes[ind]))
					li.classList.add("selected");
				else
					li.classList.remove("selected");
			});
			
		}
	},
	
	/**
	 * Used to redraw all the SVG elements (source/destination nodes and connection lines)
	 */
	refreshSVG : function ()
	{
		// empty SVG canvas
		$(this.svg).empty();
		
		//create the SVG texture
		this.initTextures();

		// draw the svg background
		this.drawCanvas();
		
		// draw balloon plot
		var origin = [this.svgDim[0]/2, this.svgDim[1]/2];
		var dim = [this.svgDim[0]/2, this.svgDim[1]/2];
		this.drawNodes(0, this.viewNodes[0].childNodes, origin, dim);
    	this.drawNodes(1, this.viewNodes[1].childNodes, origin, dim);
    	
    	// draw connections
    	this.drawConnections();
	},

	connect : function (src, dst)
	{
		if(this.model.isConnected(src.signalName, dst.signalName) == false)
		{
			var srcDev = src.deviceName;
			var dstDev = dst.deviceName;
			if(this.model.isLinked(srcDev, dstDev) == false)				// devices must be linked before a connection can be made
					$(this._container).trigger("link", [srcDev, dstDev]);	// trigger link event
			$(this._container).trigger("connect", [src.signalName, dst.signalName]);	// trigger connect event
			
			this.refreshSVG();
		}
	},
	
	initTextures : function()
	{
		var defs = document.createElementNS(this.svgNS, "defs");
		var pattern, path;
		
		pattern = document.createElementNS(this.svgNS, "pattern");
		pattern.setAttribute('id', "Balloon_leafNodePattern");
		pattern.setAttribute('patternUnits', 'userSpaceOnUse');
		pattern.setAttribute('width', "3");
		pattern.setAttribute('height', "3");

		path = document.createElementNS(this.svgNS, 'rect');
		path.setAttribute("width", "3");
		path.setAttribute("height", "5");
		path.setAttribute("style", "stroke: none; fill: #29B1D7");
		pattern.appendChild(path);

		path = document.createElementNS(this.svgNS, 'path');
		path.setAttribute("d", "M 0 2 l 3 0");
		path.setAttribute("style", "stroke: #fff; stroke-width: 2px;");
		pattern.appendChild(path);

		defs.appendChild(pattern);
		this.svg.appendChild(defs);
	}
	
};

/**
 * Class for a node in the balloon tree
 */
function BalloonNode()
{
	this.level;				// level in the hierarchy  (-1 for root)
	this.label;				// namespace 
	this.signalName;		// the full signal namespace			**FIX
	this.deviceName;
	this.parentNode;		// stores the parent node (null for root)
	this.childNodes = [];	// stores all child nodes
	this.childIndex;		// notes index into parent nodes array of child nodes
	this.direction;			// source or destination signal (0/1)
	this.svg;				// holds the SVG DOM element for the node
};

BalloonNode.prototype = {
	
		/**
		 * Determines if the node is a terminal node (leaf) or not (branch)
		 */
		isLeaf : function()
		{
			return (this.childNodes.length==0);
		},
		
		/**
		 * comparison function for matching two nodes 
		 * @param node the node to match to
		 */
		equals : function (node)
		{
			if(	this.signalName == node.signalName &&
				this.label == node.label &&
				this.level == node.level )
					return true;
				else
					return false;
		},
		
		deleteNode : function()
		{
			// cleanup child elements recursively
			var n = this.childNodes.length; 
			if(n>0){
				for(var i=0; i<n; i++){
					this.childNodes[i].deleteNode();
				}
			}
			
			// cleanup this element
			delete this.svg;
				
		},
		
		getNode : function (node)
		{

			if(this.equals(node))
			{
				return this;
			}
			
			// check with children
			else
			{
				var foundNode = false;
				for(var i=0; i<this.childNodes.length; i++)
				{
					foundNode = this.childNodes[i].getNode(node);
					if(foundNode != false)
						break;
				}
				
				if(foundNode != false)
					return foundNode;
				else
					return false;
			}
		},
		
		/**
		 * recursive function to get all descendant connected nodes
		 * @param nodes array of nodes to check
		 * @returns	an array of the connected nodes
		 */
		getConnected : function(nodes)
		{
			var result = [];
			
			if(!nodes || nodes.length < 1)
				return result;
			
			// check all nodes
			for(var i=0; i<nodes.length; i++)
			{
				var node = nodes[i];
				
				// if leaf, simple check
				if(node.isLeaf())
				{
					if(model.isConnected(this.signalName, node.signalName))
					{
						result.push(node);
					}
				}
				// if branch, call recursive
				else
				{
					result = result.concat(this.getConnected(node.childNodes));
				}
			}
			return result;
		},
		
		/** 
		 * Recursive function for getting all descendant nodes
		 */
		getDescendantLeafNodes : function()
		{
			var result = [];
			
			if(this.isLeaf()){
				result.push(this);
			}
			else{
				for(var i=0; i<this.childNodes.length; i++){
					result = result.concat(this.childNodes[i].getDescendantLeafNodes());
				}
			}
			return result;
		}
};






	