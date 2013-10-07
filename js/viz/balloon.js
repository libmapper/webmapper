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
	
	//Keyboard handlers
	document.onkeydown = function(e){
		_self.keyboardHandler(e);
	};
		
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
		wrapperDiv.appendChild(this.svg);	
		
		// add destination table DIV
		this.tables[1] = document.createElement("div");
		this.tables[1].setAttribute("id", "balloonTable_dst");
		this.tables[1].setAttribute("class", "balloonTable");
		this.tables[1].setAttribute("style", "width: " + this.tableWidth + "px; height: " + this.svgDim[1] + "px;");
		wrapperDiv.appendChild(this.tables[1]);
		
		this.refreshData();
		this.on_resize();
		this.createTables();
	},
	
	keyboardHandler : function (e)
	{
		
	},
	
	get_selected_connections: function (list)
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
		//document.onkeydown = null;
	},
	
	/**
	 * Draws the SVG container elements
	 */
	drawCanvas : function ()
	{
		var obj;
		var _self = this;
		
		// source exterior
		obj = document.createElementNS(this.svgNS,"rect");
		obj.setAttribute("x", 0);		
		obj.setAttribute("width", this.svgDim[0]/2);		
		obj.setAttribute("height", this.svgDim[1]);			
		obj.setAttribute("class", "BalloonCorner");
		obj.addEventListener("click", function(evt){
			_self.onBackClick(0);
		});
		this.svg.appendChild(obj);

		// destination exterior
		obj = document.createElementNS(this.svgNS,"rect");
		obj.setAttribute("x", this.svgDim[0]/2);		
		obj.setAttribute("width", this.svgDim[0]/2);		
		obj.setAttribute("height", this.svgDim[1]);			
		obj.setAttribute("class", "BalloonCorner");
		obj.addEventListener("click", function(evt){
			_self.onBackClick(1);
		});
		this.svg.appendChild(obj);
		
		// cutout the middle with a white ellipse
		obj = document.createElementNS(this.svgNS,"ellipse");
		var w = this.svgDim[0]/2 + 1 - 20;
		var h = this.svgDim[1]/2 + 1 + 20;
		obj.setAttribute("cx", this.svgDim[0]/2);		
		obj.setAttribute("cy", this.svgDim[1]/2);		
		obj.setAttribute("rx", w);						
		obj.setAttribute("ry", h);						
		obj.setAttribute("fill", "#fff");
		this.svg.appendChild(obj);
	},
	
	/**
	 * Given a set of nodes, calculates the size and position to plot them in the SVG canvas
	 * Nodes are separated with sources on the left and destinations on the right
	 * Radius is determined by Aaron's magical formula to calculate the largest possible circles that will fit inside the container ellipse
	 * 
	 * @param ind source or destination
	 * @param nodes the set of nodes to draw
	 */
	drawNodes : function (ind, nodes)
	{
		// number of nodes
		var n = nodes.length;

		// calculate radius of nodes
		// Aaron's magical formula for determining largest possible circle to fill the container circle's space
		// *sometimes the circles overlap because the container is an ellipse and the formula is for circles
		var r = 1 / ( 1 / Math.sin( Math.PI / (2*n) ) + 1 );	
		// multiply by container's radius
		// choose the smaller dimension to minimize overlap  
		var containerR = (Math.min(this.svgDim[1], this.svgDim[0])/2) - 50;		
		r = r * containerR;							
																
		// calculate angles
		var angleFrom = 0 * Math.PI / 180;		// start angle		
		var angleTo = 180 * Math.PI / 180;		// end angle
		var range = angleTo - angleFrom;		// total arc size
		var angleInc = (n==1)? 0 : range/(n);	// angle to increment on each step
		var angleFromOffset = (ind==0)? Math.PI/2 : - Math.PI/2;	// offset sources and destinations to their respective sides
		if (n==1) angleFromOffset += Math.PI/2;	// special case, if only one node then place it in the center
		
		//  plot helpers
		var origin = [this.svgDim[0]/2, this.svgDim[1]/2];
		var w = this.svgDim[0]/2 - r - 100;		// container ellipse width minus radius of node with extra padding
		var h = this.svgDim[1]/2 - r - 10;		// container ellipse height minus radius of node with extra padding
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
		
		// draw the node
		node.svg = document.createElementNS(this.svgNS,"circle");
		node.svg.setAttribute("cx", x);						// x-position
		node.svg.setAttribute("cy", y);						// y-position
		node.svg.setAttribute("data-ind", ind);				// src or destination
		node.svg.setAttribute("data-childIndex", childIndex);	// index into the container array
		node.svg.setAttribute("r", radius);			// radius of circle
		$(node.svg).data("node", node);
		
		var tooltip = document.createElementNS(this.svgNS,"title");
		tooltip.textContent = node.label;
		node.svg.appendChild(tooltip);
		
		var stylename;
		if(!node.isLeaf())									// for non-terminal node
		{
			stylename = "BalloonNode";
			node.svg.addEventListener("mouseover", function(evt){ _self.onNodeMouseOver(evt);	});
			node.svg.addEventListener("mouseout", function(evt){ _self.onNodeMouseOut(evt);	});
			node.svg.addEventListener("click", function(evt){ _self.onNodeClick(evt); 	});
		}
		else												// terminal node
		{
			stylename = "BalloonLeafNode";
		}
		stylename += (ind==0)? "_src" : "_dst" ;
		node.svg.setAttribute("class", stylename);
		this.svg.appendChild(node.svg);
		
		
		// draw children nodes one level deep
		if(!node.isLeaf())
		{
			node.svgChilds = [];	// clear the old SVG elements 
			var n = node.childNodes.length;
			var angleInc =  (n==1)? 0 : (180 * Math.PI / 180) / (n);
			var offset = (ind==0)? Math.PI/2 : - Math.PI/2;
			var childNodeRadius = 1 / ( 1 / Math.sin( Math.PI / (2*n) ) + 1 );
			childNodeRadius = childNodeRadius*radius;
			var childNodeRadiusPadded = childNodeRadius*0.9;	
			
			
			for(var i=0; i<n; i++)
			{
				
				var childNode = node.childNodes[i];
				var childStyle = (childNode.isLeaf()) ? "BalloonLeafNode": "BalloonNode";
				childStyle += (ind==0)? "_src" : "_dst" ;
				
				var nAngle = i*angleInc + offset + angleInc/2;
				if(n==1)
					nAngle += Math.PI/2;
				var x2 = ( (radius-childNodeRadius) * Math.cos(nAngle) ) + x;
				var y2;
				if(ind==0)
					y2 = ( -(radius-childNodeRadius) * Math.sin(nAngle) ) + y;
				else
					y2 = ( (radius-childNodeRadius) * Math.sin(nAngle) ) + y;
				
				var childNode = node.childNodes[i];
				var childSvg = document.createElementNS(this.svgNS,"circle");
				childSvg.setAttribute("cx", x2);						// x-position
				childSvg.setAttribute("cy", y2);						// y-position
				childSvg.setAttribute("data-ind", ind);				// src or destination
				childSvg.setAttribute("data-childIndex", n);	// index into the container array
				childSvg.setAttribute("r", childNodeRadiusPadded);
				childSvg.setAttribute("class", childStyle);
				//childSvg.setAttribute("style", "pointer-events: none");
				$(childSvg).data("node", childNode);
				
				childSvg.addEventListener("mouseover", function(evt){ _self.onChildNodeMouseOver(evt);	});
				childSvg.addEventListener("mouseout", function(evt){ _self.onChildNodeMouseOut(evt);	});
				childSvg.addEventListener("click", function(evt){ _self.onChildNodeClick(evt); 	});
				
				tooltip = document.createElementNS(this.svgNS,"title");
				tooltip.textContent = childNode.label;
				childSvg.appendChild(tooltip);
				
				node.svgChilds.push(childSvg);
				this.svg.appendChild(childSvg);
			}
		}
	},
	
	/**
	 * The most complicated set of for loops I've ever written... maybe a recursive algorithm could make it simpler but
	 * I found it easier to follow this way in order to debug and find the corresponding SVG elements
	 * 
	 * Connection = connection between leaf nodes
	 * Link = connection between nodes that have connected child nodes
	 * We check each source balloon with each destination balloon for a connection
	 * We must also check each soure balloon's children for links with destination nodes and child nodes
	 * 
	 */
	drawConnections : function()
	{
		// for each SOURCE node in the display
		for(var i=0; i<this.viewNodes[0].childNodes.length; i++)
		{
			// the source node currently being checked
			var src = this.viewNodes[0].childNodes[i];

			// get corresponding signals of the node
			// this is a 2D array because signals of children are grouped into an array
			var srcSignals = [];
			
			// if current node is a leaf, there's only one signal
			// wrap the signal in an array
			if(src.isLeaf())	
				srcSignals.push([src.signalName]);

			// if current node is a branch, must get all descendant signals
			// signals for each child node is wrapped in an array
			// this means the index into this array will correspond to the childIndex (used later to get the SVG child objects)  
			else				
				for(var a=0; a<src.childNodes.length; a++)
					srcSignals.push(src.childNodes[a].getDescendantSignals());
			
			
			// now we must compare to all the DESTINATION nodes in the display
			// process is the same as for sources
			// for each destination node
			for(var j=0; j<this.viewNodes[1].childNodes.length; j++)
			{
				// the destination node currently being checked
				var dst = this.viewNodes[1].childNodes[j];

				// get corresponding signals of the node
				// this is a 2D array because signals of children are grouped into an array
				var dstSignals = [];
				
				// if current node is a leaf, there's only one signal
				// wrap the signal in an array
				if(dst.isLeaf())
					dstSignals.push([dst.signalName]);
				
				// if current node is a branch, must get all descendant signals
				// signals for each child node is wrapped in an array
				// this means the index into this array will correspond to the childIndex (used later to get the SVG child objects)
				else
					for(var b=0; b<dst.childNodes.length; b++)
						dstSignals.push(dst.childNodes[b].getDescendantSignals());
				
				// now we have a list of all signals or nested signals of the current source and destination node
				// for each set of signals, we check if there is a connection
				// if src was a leaf, srcSignals will have length 1, an array with a single signal
				// if dst was a leaf, dstSignals will have length 1, an array with a single signal
				// if src was a branch, srcSignals will have length = number of childNodes, with each element an array with nested signals of the child node
				// if dst was a branch, dstSignals will have length = number of childNodes, with each element an array with nested signals of the child node
				for(var k=0; k<srcSignals.length; k++)
				{
					// source's current set of signals (1 set for a leaf, 1 or more sets for a branch)
					var currentSrcSignal_ar = srcSignals[k];
					
					for(var l=0; l<currentSrcSignal_ar.length; l++)
					{
						// the current source signal to check
						var currentSrcSignal = currentSrcSignal_ar[l];
						
						for(var m=0; m<dstSignals.length; m++)
						{
							// destination's current set of signals (1 set for a leaf, 1 or more sets for a branch)
							var currentDstSignal_ar = dstSignals[m];
							
							for(var n=0; n<dstSignals.length; n++)
							{
								// the current destination signal to check
								var currentDstSignal = currentDstSignal_ar[n];
								
								// check for a connection
								// if there is a connection, draw the line between the corresponding nodes
								if(model.isConnected(currentSrcSignal, currentDstSignal))
								{
									var ctX1 =  this.svgDim[0]/2;
									var ctY1 =  this.svgDim[1]/2;
									var x1,y1,x2,y2;
									
									// if src is leaf, connect from center of the node
									if(src.isLeaf())
									{
										x1 = src.svg.getAttribute("cx");	
										y1 = src.svg.getAttribute("cy");	
									}
									// if branch, connect from the center of the child node
									// k corresponds to the index into srcSignals and also the childIndex because there is one set per child
									else
									{
										x1 = src.svgChilds[k].getAttribute("cx");
										y1 = src.svgChilds[k].getAttribute("cy");
									}
									
									// if dst is leaf, connect from center of the node
									if(dst.isLeaf())
									{
										x2 = dst.svg.getAttribute("cx");	
										y2 = dst.svg.getAttribute("cy");
									}
									// if branch, connect from the center of the child node
									// m corresponds to the index into dstSignals and also the childIndex because there is one set per child
									else
									{
										x2 = dst.svgChilds[m].getAttribute("cx");
										y2 = dst.svgChilds[m].getAttribute("cy");
									}
									
									// create the SVG line element
									var line = document.createElementNS(this.svgNS,"path");
									line.setAttribute("d", "M " + x1 + " " + y1 + " Q " + ctX1 + " " + ctY1 + " " + x2 + " " + y2);
									line.setAttribute("class", "balloonConnection");
									this.svg.appendChild(line);
									
									// don't need to check other signals from the same dst child because
									// if leafs there's only 1 connection, and if branches, drawing multiple connections is redundant
									// in the future, can possibly have some data viz (e.g. line width or opacity overlay) for multiple links
									break;	
								}
							}
						}
					}
				}
			}
		}
		// phew! that wasn't so bad, was it?		
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
		var item = evt.currentTarget;
		var node = $(item).data("node");
		var childIndex = node.childIndex;
		var ind = item.getAttribute("data-ind");
		this.viewNodes[ind] = this.viewNodes[ind].childNodes[childIndex];
		this.refreshSVG();
		this.updateTable(ind);
	},
	/**
	 * Handles clicking on a node in the SVG plot 
	 */
	onChildNodeClick : function(evt)
	{
		var item = evt.currentTarget;
		var node = $(item).data("node").parentNode;
		var childIndex = node.childIndex;
		var ind = item.getAttribute("data-ind");
		this.viewNodes[ind] = this.viewNodes[ind].childNodes[childIndex];
		this.refreshSVG();
		this.updateTable(ind);
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
	
	
	/**
	 * Function to create/add nodes into the tree given a signal namespace
	 * 
	 * @param namespaces an array with each namespace ('/' removed)
	 * @param currentNode the node to check (used in recursion)
	 * @param level used to set the level in the hierarchy
	 * @returns
	 */
	addSignal : function (signalName, namespaces, currentNode, level, ind)
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
			node.signalName = signalName;
			currentNode.childNodes.push(node);
		}
		
		// recurse for next level or return 
		if(namespaces.length > 1)
		{
			namespaces.splice(0,1);					
			this.addSignal(signalName, namespaces, node, level+1, ind);
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
		// create root node for the source/destination trees
		for(var i=0; i<2; i++)
		{
			var tree = new BalloonNode();
			tree.parentNode = null;
			tree.label = this.rootLabel[i];
			tree.level = -1;
			tree.direction = i;
			this.trees[i] = tree;
		}
		
		// prep the data
		var keys = this.model.signals.keys();
	    for (var i=0; i<keys.length; i++) 
	    {
	    	var sig = this.model.signals.get(keys[i]);
	        var sigName = sig.device_name + sig.name;
	        var namespaces = sigName.split("/").filter(function(e) { return e; });// splits and removes empty strings
	        this.addSignal(sigName, namespaces, this.trees[1-sig.direction], 0, 1-sig.direction);	// FIX sig.direction will become an ENUM constant
	    }
	
	    for(var i=0; i<2; i++)
    	{
	    	// if view level is not set by user, set it to the root
	    	if(this.viewNodes[i]==null)
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
		
		// draw the svg background
		this.drawCanvas();
		
		// draw balloon plot
		this.drawNodes(0, this.viewNodes[0].childNodes);
    	this.drawNodes(1, this.viewNodes[1].childNodes);
    	
    	// draw connections
    	this.drawConnections();
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
	this.parentNode;		// stores the parent node (null for root)
	this.childNodes = [];	// stores all child nodes
	this.childIndex;		// notes index into parent nodes array of child nodes
	this.direction;			// source or destination signal (0/1)
	this.svg;				// holds the SVG DOM element for the node
	this.svgChilds = [];	// holds the SVG DOME elements for the child nodes
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
		
		/** 
		 * Recursive function for getting all descendant signals of a node
		 */
		getDescendantSignals : function()
		{
			var result = [];
			if(this.childNodes.length>0){
				for(var i=0; i<this.childNodes.length; i++){
					result = result.concat(this.childNodes[i].getDescendantSignals());
				}
			}
			else{
				result.push(this.signalName);
			}
			return result;
		}
		
};






