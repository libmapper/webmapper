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
	
	
	//this.devs;					// to hold libmapper devices
	//this.devTrees = [[],[]];	// to hold balloon trees for each device
	
	this.trees = [null, null];
	this.viewNodes = [null, null];
	
	
	//Keyboard handlers
	document.onkeydown = function(e){
		_self.keyboardHandler(e);
	};
		
}

BalloonView.prototype = {
		
	init : function () 
	{ 
		var _self = this;	// to pass to the instance of LibMApperMatrixView to event handlers
		var div, btn;		// to instantiate items
		
		$(this._container).empty();
		
		// create the wrapper DIV
		var wrapper = document.createElement("div");
		wrapper.setAttribute("id", "balloonWrapper");
		this._container.appendChild(wrapper);
		
		// add SVG canvas
		this.svg = document.createElementNS(this.svgNS,"svg");
		this.svg.setAttribute("id", "BalloonSVG");
		this.svg.setAttribute("xmlns", this.svgNS);
		this.svg.setAttribute("xmlns:xlink", this.svgNSxlink);
		this.svg.setAttribute("width", this.svgDim[0]);
		this.svg.setAttribute("height", this.svgDim[1]);
		this.svg.setAttribute("style", "float:left;margin: 0 auto;");
		wrapper.appendChild(this.svg);	
		
		wrapper = document.createElement("div");
		wrapper.setAttribute("id", "output");
		this._container.appendChild(wrapper);
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
		this.svgDim[0] = w;
		this.svgDim[1] = h;
		
		// re initialize SVG and update the display
		this.init();
		this.update_display();
	},
	
	cleanup : function ()
	{
		//document.onkeydown = null;
	},
	
	drawNegativeSpace : function ()
	{
		
	},
	
	drawArc : function (ind, nodes)
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
			var nAngle = angleFrom + angleFromOffset + (i*angleInc);
			var x = ( w * Math.cos(nAngle) ) + origin[0] + positionOffset;
			var y = ( h * Math.sin(nAngle) ) + origin[1];
			
			this.drawNode(ind, x, y, i);
		}
	},
	
	drawNode : function (ind, x, y, childIndex)
	{
		var _self = this;
		
		var stylename = (ind==0)? "BalloonNode_src" : "BalloonNode_dst" ;
		
		var circle = document.createElementNS(this.svgNS,"circle");
		circle.setAttribute("cx", x);
		circle.setAttribute("cy", y);
		circle.setAttribute("data-ind", ind);
		circle.setAttribute("data-childIndex", childIndex);
		circle.setAttribute("r", this.nodeRadius);
		circle.setAttribute("class", stylename);
		circle.addEventListener("mouseover", function(evt){ _self.onNodeMouseOver(evt);	});
		circle.addEventListener("mouseout", function(evt){ _self.onNodeMouseOut(evt);	});
		circle.addEventListener("click", function(evt){ _self.onNodeClick(evt); 	});
		
		this.svg.appendChild(circle);
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
		var childIndex = item.getAttribute("data-childIndex");
		var ind = item.getAttribute("data-ind");
		this.viewNodes[ind] = this.viewNodes[ind].childNodes[childIndex];
		this.update_display();
		
	},
	
	
	
	/**
	 * Function to create/add nodes into the tree given a signal namespace
	 * 
	 * @param namespaces an array with each namespace ('/' removed)
	 * @param currentNode the node to check (used in recursion)
	 * @param level used to set the level in the hierarchy
	 * @returns
	 */
	add : function (namespaces, currentNode, level)
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
			currentNode.childNodes.push(node);
		}
		
		// recurse for next level
		if(namespaces.length > 1){
			namespaces.splice(0,1);					
			this.add(namespaces, node, level+1);
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
		var ul = document.createElement("UL");
		 
		// create a LI for the node
		var li = document.createElement("LI");
		li.innerHTML = " (" + node.level + ") " + node.label;
		ul.appendChild(li);
		
		// recursively create an UL for its children
		var n = node.childNodes.length;
		if(n>0)
		{
			for(var i=0; i<n; i++)
				ul.appendChild(this.print(node.childNodes[i]));
		}

		return ul;
	},
	
	update_display : function ()
	{
		// empty SVG canvas
		$(this.svg).empty();
		
		/*
		// prep the data
		var ind=0;
		this.devs = this.model.getDevices();
		for(var i=0; i<this.devs[ind].length; i++)
		{
			var devName = this.devs[ind][i].name;
		}
		*/
		
		// create the trees for source and destinations
		for(var i=0; i<2; i++)
		{
			var tree = new BalloonNode();
			tree.parentNode = null;
			tree.label = "root";
			tree.level = -1;
			this.trees[i] = tree;
		}
		
		// prep the data
		var keys = this.model.signals.keys();
	    for (var i=0; i<keys.length; i++) 
	    {
	        var sigName = keys[i];
	        var sig = this.model.signals.get(keys[i]);
	        var namespaces = sigName.split("/").filter(function(e) { return e; });// splits and removes empty strings
	        this.add(namespaces, this.trees[sig.direction], 0);	// FIX sig.direction will become an ENUM constant
	    }
	
	    // if view level is not set by user, set it to the root
	    for(var i=0; i<2; i++)
    	{
	    	if(this.viewNodes[i]==null)
	    		this.viewNodes[i] = this.trees[i];
    	}
	    
	    // draw
	    for(var i=0; i<2; i++){
	    	this.drawArc(i, this.viewNodes[i].childNodes);
	    }

	    
	    $('#output').empty();
	    document.getElementById("output").appendChild(this.print(this.trees[0]));
	    document.getElementById("output").appendChild(this.print(this.trees[1]));
	    
		//this.drawArc(0);
		//this.drawArc(1);		
	}
};


function BalloonNode()
{
	this.level;
	this.label;
	this.parentNode;
	this.childNodes = [];
	this.childIndex;
};







