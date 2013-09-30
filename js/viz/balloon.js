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
	this.nodeRadius = 50;
	this.tableWidth = 200;
	
	//this.devs;					// to hold libmapper devices
	//this.devTrees = [[],[]];	// to hold balloon trees for each device
	
	this.trees = [null, null];
	this.viewNodes = [null, null];
	this.tables = [null, null];
	
	
	//Keyboard handlers
	document.onkeydown = function(e){
		_self.keyboardHandler(e);
	};
		
}

BalloonView.prototype = {
		
	init : function () 
	{ 
		var _self = this;	// to pass to the instance of LibMApperMatrixView to event handlers
		var wrapperDiv, div, btn;		// to instantiate items
		
		$(this._container).empty();
		
		// create the wrapper DIV
		wrapperDiv = document.createElement("div");
		wrapperDiv.setAttribute("id", "balloonWrapper");
		this._container.appendChild(wrapperDiv);
		
		// add source table
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
		
		// add destination table
		this.tables[1] = document.createElement("div");
		this.tables[1].setAttribute("id", "balloonTable_dst");
		this.tables[1].setAttribute("class", "balloonTable");
		this.tables[1].setAttribute("style", "width: " + this.tableWidth + "px; height: " + this.svgDim[1] + "px;");
		wrapperDiv.appendChild(this.tables[1]);

		/*
		// for debug output
		wrapper = document.createElement("div");
		wrapper.setAttribute("id", "output");
		this._container.appendChild(wrapper);
		*/
	},
	
	keyboardHandler: function (e)
	{
		
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
	
	on_resize : function ()
	{
		// get the new window size
		var w = $(this._container).width();
		var h = $(this._container).height();
		this.svgDim[0] = w - this.tableWidth*2;
		this.svgDim[1] = h;
		
		// re initialize SVG and update the display
		this.init();
		this.update_display();
	},
	
	cleanup : function ()
	{
		//document.onkeydown = null;
	},
	
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
		
		// coutout the middle with a white ellipse
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
	
	drawNodes : function (ind, nodes)
	{
		var n = nodes.length;

		var angleFrom = 0 * Math.PI / 180;		
		var angleTo = 180 * Math.PI / 180;		
		var range = angleTo - angleFrom;
		var angleInc = (n==1)? 0 : range/(n-1);
		
		var origin = [this.svgDim[0]/2, this.svgDim[1]/2];
		var w = this.svgDim[0]/2 - this.nodeRadius - 100;
		var h = this.svgDim[1]/2 - this.nodeRadius - 10;
		
		var angleFromOffset = (ind==0)? Math.PI/2 : - Math.PI/2;
		if(n==1)
			angleFromOffset += Math.PI/2;
		var positionOffset = (ind==0)?  -this.nodeRadius-10 : this.nodeRadius+10;
		
		for(var i=0; i<n; i++)
		{
			var node = nodes[i];
			
			var nAngle = angleFrom + angleFromOffset + (i*angleInc);
			var x = ( w * Math.cos(nAngle) ) + origin[0] + positionOffset;
			var y = ( h * Math.sin(nAngle) ) + origin[1];
			
			this.drawNode(node, ind, x, y, i);
		}
		
		
		
	},
	
	drawNode : function (node, ind, x, y, childIndex)
	{
		var _self = this;
		
		// draw the node
		node.svg = document.createElementNS(this.svgNS,"circle");
		node.svg.setAttribute("cx", x);						// x-position
		node.svg.setAttribute("cy", y);						// y-position
		node.svg.setAttribute("data-ind", ind);				// src or destination
		node.svg.setAttribute("data-childIndex", childIndex);	// index into the container array
		node.svg.setAttribute("r", this.nodeRadius);			// radius of circle
		$(node.svg).data("node", node);
		
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
			var n = node.childNodes.length;
			var angleInc =  (n==1)? 0 : (360 * Math.PI / 180) / (n);
			var childNodeRadius = this.nodeRadius/6;
			for(var i=0; i<n; i++){
				var nAngle = i*angleInc;
				var x2 = ( (this.nodeRadius-childNodeRadius-2) * Math.cos(nAngle) ) + x;
				var y2 = ( (this.nodeRadius-childNodeRadius-2) * Math.sin(nAngle) ) + y;
				
				var childNode = node.childNodes[i];
				var childSvg = document.createElementNS(this.svgNS,"circle");
				childSvg.setAttribute("cx", x2);						// x-position
				childSvg.setAttribute("cy", y2);						// y-position
				childSvg.setAttribute("data-ind", ind);				// src or destination
				childSvg.setAttribute("data-childIndex", n);	// index into the container array
				childSvg.setAttribute("r", childNodeRadius);
				childSvg.setAttribute("class", stylename);
				$(childSvg).data("node", childNode);
				node.svgChilds.push(childSvg);
				this.svg.appendChild(childSvg);
			}
		}
	},
	
	onNodeMouseOver : function(evt)
	{
		evt.currentTarget.classList.add('BalloonNode_over');
	},
	
	onNodeMouseOut : function(evt)
	{
		evt.currentTarget.classList.remove('BalloonNode_over');
	},
	
	onNodeClick : function(evt)
	{
		var item = evt.currentTarget;
		var node = $(item).data("node");
		var childIndex = item.getAttribute("data-childIndex");
		var ind = item.getAttribute("data-ind");
		this.viewNodes[ind] = this.viewNodes[ind].childNodes[childIndex];
		this.update_display();
		
	},
	
	onListClick : function (evt)
	{
		var item = evt.currentTarget;
		var node = $(item).data("node");
		var ind = node.direction;
		if(node.isLeaf())
		{
			this.viewNodes[ind] = node.parentNode;

			// set it as selected
		}
		else
		{
			this.viewNodes[ind] = node;
		}
		this.update_display();
	},
	
	onListOver : function (evt)
	{
		
	},
	
	onBackClick : function (ind)
	{
		if(this.viewNodes[ind].parentNode != null)
		{
			this.viewNodes[ind] = this.viewNodes[ind].parentNode;
			this.update_display();
		}
	},
	
	drawTable : function (ind)
	{
		var _self = this;
		
		// empty the DIV contents
		$(this.tables[ind]).empty();

		// navigation button
		var btn = document.createElement("button");
		btn.innerHTML = "Back";
		//btn.setAttribute("style", "float: left;");
		btn.title = "Go Up a level";
		btn.addEventListener("click", function(evt){ 
			_self.onBackClick(ind); 
		});
		this.tables[ind].appendChild(btn);
		
		// print the heirarchy trail 
    	var p = document.createElement("p");
    	p.innerHTML = this.printBreadCrumbs(ind, this.viewNodes[ind]);
    	this.tables[ind].appendChild(p);
		
		// print the tree
    	this.tables[ind].appendChild(this.print(this.trees[ind]));
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
		
		// recurse for next level
		if(namespaces.length > 1){
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
	print : function (node)
	{
		var _self = this;
		var ul; 

//		if(node.label != "root")
//		{
			ul = document.createElement("ul");
			
			// create a LI for the node
			var li = document.createElement("li");
			li.innerHTML = node.label;
			$(li).data("node", node);
			li.addEventListener("click", function(evt){ _self.onListClick(evt); 	});
			if(
					this.viewNodes[node.direction].signalName == node.signalName &&
					this.viewNodes[node.direction].label == node.label &&
					this.viewNodes[node.direction].level == node.level 
				)
			{
				li.setAttribute("class", "balloonTableLI_inView");
			}
			ul.appendChild(li);
//		}
//		else
//			ul = document.createElement("div");
		
		// recursively create an UL for its children
		var n = node.childNodes.length;
		if(n>0)
		{
			for(var i=0; i<n; i++)
				ul.appendChild(this.print(node.childNodes[i]));
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
		// empty SVG canvas
		$(this.svg).empty();
		
		// draw the svg background
		this.drawCanvas();
		 
		// create root node for the source/destination trees
		for(var i=0; i<2; i++)
		{
			var tree = new BalloonNode();
			tree.parentNode = null;
			tree.label = (i==0)? "Sources" : "Destinations";
			tree.level = -1;
			tree.direction = i;
			this.trees[i] = tree;
		}
		
		// prep the data
		var keys = this.model.signals.keys();
	    for (var i=0; i<keys.length; i++) 
	    {
	        var sigName = keys[i];
	        var sig = this.model.signals.get(keys[i]);
	        var namespaces = sigName.split("/").filter(function(e) { return e; });// splits and removes empty strings
	        this.addSignal(sigName, namespaces, this.trees[sig.direction], 0, sig.direction);	// FIX sig.direction will become an ENUM constant
	    }
	
	    for(var i=0; i<2; i++)
    	{
	    	// if view level is not set by user, set it to the root
	    	if(this.viewNodes[i]==null)
	    		this.viewNodes[i] = this.trees[i];
	    	
	    	// draw balloon plot
	    	this.drawNodes(i, this.viewNodes[i].childNodes);
	    	
	    	// draw tables
	    	this.drawTable(i);
    	}
	    
	   
	}
};


function BalloonNode()
{
	this.level;
	this.label;
	this.signalName;
	this.parentNode;
	this.childNodes = [];
	this.childIndex;
	this.direction;
	this.svg;
	this.svgChilds = [];
};

BalloonNode.prototype = {
	
		isLeaf : function()
		{
			return (this.childNodes.length==0);
		}
};






