function GridDevices(){
	this.includedSrcs = new Array();
	this.includedDsts = new Array();
	this.selectedLabels = new Array();
};
GridDevices.prototype = new GridSVG;
GridDevices.prototype.constructor = GridDevices; 


GridDevices.prototype.refresh = function ()
{
	var _self = this;

	$('#svgGrid' + this.gridIndex).empty();
	$('#svgRows' + this.gridIndex).empty();
	$('#svgCols' + this.gridIndex).empty();
	
	// patterns for textured cells
	var defs = document.createElementNS(this.svgNS, "defs");
	var pattern, path;
	
	pattern = document.createElementNS(this.svgNS, "pattern");
	pattern.setAttribute('id', "Pattern_IncludedSrc");
	pattern.setAttribute('patternUnits', 'objectBoundingBox');
	pattern.setAttribute('width', "100%");
	pattern.setAttribute('height', 32);
	path = document.createElementNS(this.svgNS, 'path');
	path.setAttribute("d", "M 16 1 l 0 30 ");
	path.setAttribute("style", "stroke: darkBlue; fill: none; ");
	pattern.appendChild(path);
	defs.appendChild(pattern);
	
	pattern = document.createElementNS(this.svgNS, "pattern");
	pattern.setAttribute('id', "Pattern_IncludedDst");
	pattern.setAttribute('patternUnits', 'objectBoundingBox');
	pattern.setAttribute('width', 32);
	pattern.setAttribute('height', "100%");
	path = document.createElementNS(this.svgNS, 'path');
	path.setAttribute("d", "M 1 16 l 30 0");
	path.setAttribute("style", "stroke: darkBlue; fill: none;");
	pattern.appendChild(path);
	defs.appendChild(pattern);
	
	this.svg.appendChild(defs);
	
	
	this.cells.length = 0;
	this.nCellIds = 0;
	this.nRows = 0;
	this.nCols = 0;

	this.contentDim[0] = this.filteredData[0].length*(this.cellDim[0]+this.cellMargin);
	this.contentDim[1] = this.filteredData[1].length*(this.cellDim[1]+this.cellMargin);

	// sort devices
	this.filteredData[0].sort(this.compareLabel);
	this.filteredData[1].sort(this.compareLabel);
	
	
	// when autozoom is on, strech to fit into canvas
	// must be done first to set the font size
	if(this.autoZoom && this.contentDim[0] > 0 && this.contentDim[1] > 0)
	{
		var originalDim = this.vboxDim[0];	//keep original dimension for calculating zoom of font
		this.vboxPos = [0, 0];		// place viewbox at origin 
		
		// attempt to fit width
		this.vboxDim[0] = this.contentDim[0];
		this.vboxDim[1] = this.contentDim[0] / this.aspect;
		// if width causes height to be clipped, choose height instead
		if(this.vboxDim[1] < this.contentDim[1])
		{
			this.vboxDim[1] = this.contentDim[1];
			this.vboxDim[0] = this.contentDim[1] * this.aspect;
		}
		
		// font size stuff
		var ratio = (originalDim - this.vboxDim[0]) / originalDim;
		this.fontSize = this.fontSize - (this.fontSize*ratio);
	}
	
	
	// create column labels
	for (var index=0; index< this.filteredData[0].length; index++)
	{
		var dev = this.filteredData[0][index];
		var label = document.createElementNS(this.svgNS,"text");
		
		var name = dev.name;
			
		label.setAttribute("id", "colLabel" + this.nCols  );
		label.setAttribute("data-src", name);
		label.setAttribute("data-col", this.nCols);
		label.setAttribute("font-size", this.fontSize + "px");
		label.setAttribute("class", "label");
		label.setAttribute("text-anchor", "end");
	
		label.addEventListener("click", function(evt){
			_self.onLabelClick(evt, _self);
		});
		
		// pad slashes in namespace to make label easier to read
		var patt = /\//g;
		var nameFormatted = name.replace(patt, " / ");
		
		// tooltip for long names
		var tooltip = document.createElementNS(this.svgNS,"title");
		tooltip.textContent = nameFormatted;
		label.appendChild(tooltip); 	

		
		label.appendChild(document.createTextNode(nameFormatted));
		this.svgColLabels.appendChild(label);

		var xPos = ((this.nCols)*(this.cellDim[0]+this.cellMargin) + Math.floor(this.cellDim[0]/2) - 1 ); // I don't know why -1 .... getBBox() doesn't really work well 
		var yPos = this.colLabelsH;
		label.setAttribute("transform","translate(" + xPos + "," + yPos + ")rotate(90)");
		
		this.nCols++;
	}
	
	// create row labels
	for (var index=0; index< this.filteredData[1].length; index++)
	{	
		var dev = this.filteredData[1][index];
		var label = document.createElementNS(this.svgNS,"text");
		
		var name = dev.name;
		
		label.setAttribute("id", "rowLabel" + this.nRows);
		label.setAttribute("data-dst", name);
		label.setAttribute("data-row", this.nRows);
		label.setAttribute("font-size", this.fontSize + "px");
		label.setAttribute("class","label");
		label.setAttribute("text-anchor", "end");
		label.setAttribute("x", this.rowLabelsW);
		label.setAttribute("y", (this.nRows)*(this.cellDim[1]+this.cellMargin) + Math.ceil(this.cellDim[1]/2) + 2 );
		
		label.addEventListener("click", function(evt){
			_self.onLabelClick(evt, _self);
		});
		
		// pad slashes in namespace to make label easier to read
		var patt = /\//g;
		var nameFormatted = name.replace(patt, " / ");
		
		// tooltip for long names
		var tooltip = document.createElementNS(this.svgNS,"title");
		tooltip.textContent = nameFormatted;
		label.appendChild(tooltip); 	

		
		label.appendChild(document.createTextNode(nameFormatted));
		this.svgRowLabels.appendChild(label);
		

		this.nRows++;
	}
	
	//FIX part 1/3
	var newSelected = [];
	
	// create the cells  
	for(var i=0; i<this.nRows; i++){
		for(var j=0; j<this.nCols; j++)
		{
			var rowLabel = this.svgRowLabels.getElementById("rowLabel" + i);		
			var colLabel = this.svgColLabels.getElementById("colLabel" + j);	
			var src = colLabel.getAttribute("data-src");
			var dst = rowLabel.getAttribute("data-dst");
			var cell = this.createCell(i, j, src, dst);
			
			// set the default style class 
			// used for example, when reverting from mouseover style
			cell.setAttribute("class", cell.getAttribute("defaultClass"));
			this.svg.appendChild(cell);
			
			// extra styling for devices, if added into view
			if(this.includedSrcs)
			for(var k=0; k<this.includedSrcs.length; k++)
			{
				var includedSrc = this.includedSrcs[k];
				if(src == includedSrc)
				{
					var cell2 = cell.cloneNode();
					cell2.removeAttribute("id");
					cell2.setAttribute("class", "includedSrc");
					cell2.setAttribute("style", "pointer-events: none");
					this.svg.appendChild(cell2);
				}
			}
			if(this.includedDsts)
			for(var k=0; k<this.includedDsts.length; k++)
			{
				var includedDst = this.includedDsts[k];
				if(dst == includedDst){
					var cell3 = cell.cloneNode();
					cell3.removeAttribute("id");
					cell3.setAttribute("class", "includedDst");
					cell3.setAttribute("style", "pointer-events: none");
					this.svg.appendChild(cell3);
				}
			}
			
			
			// set the selected cells
			// FIX part 2/3: This is dangerous. The selectedCells array points to a DOM element that were removed with empty 
			// but it seems that all the attributes are still stored in the this.selectedCells
			// so I check if the created cell has the same src/dst and the reset the selected cell
			// should be fixed by storing srn/dst identifiers instead of reference to the actual cell
			for (var k=0; k<this.selectedCells.length; k++)
			{
				var c = this.selectedCells[k];
				if (c.getAttribute("data-src") == src && c.getAttribute("data-dst") == dst)
				{
					newSelected.push(cell);
					
//					var cell4 = cell.cloneNode();
//					cell4.removeAttribute("id");
//					cell4.setAttribute("class", "cell_selected");
//					cell4.setAttribute("style", "pointer-events: none; fill: none");
//					this.svg.appendChild(cell4);
				}
			}

		}
	}
	
	//FIX part 3/3
	this.selectedCells = newSelected;
	for (var k=0; k<this.selectedCells.length; k++)
		this.selectedCells[k].classList.add('cell_selected');

	// create the connections
	for (var i=0; i< this.connectionsArray.length; i++)
	{
		var conn = this.connectionsArray[i];
		var s = conn[0];	// source
		var d = conn[1];	// destination
		
		for (var j=0; j<this.cells.length; j++)
		{
			var src = this.cells[j].getAttribute("data-src"); 
			var dst = this.cells[j].getAttribute("data-dst");
			if(s == src && d == dst)
			{
				this.cells[j].classList.add('cell_connected');
			}	
		}
	}

	this.updateViewBoxes();
	this.updateZoomBars();
	
	if(this.mousedOverCell)
	{
		this.triggerMouseOver(this.mousedOverCell);
	}
	
};

GridDevices.prototype.onLabelClick = function (evt, _self)
{
	_self.makeActiveGrid();
	_self.selectedCells_clearAll();
	
	var label = evt.target;
	
	// if COMMAND key is pressed, user is adding/removing to selection
	
	if(evt.metaKey)	// COMMAND key on MAC, CONTROL key on PC
	{
		if(_self.selectedLabels_getLabelIndex(label) == -1)	// not already selected
			_self.selectedLabels_addLabel(label);
		else
			_self.selectedLabels_removeLabel(label);
	}
	
	// if COMMAND is not pressed, then user is selecting a single cell
	
	else
	{
		if(_self.selectedLabels.length == 0)		// case: no selected cell
		{
			_self.selectedLabels_addLabel(label);
		}
		else if(_self.selectedLabels.length == 1)		// case: one selected cell
		{
			if(_self.selectedLabels_getLabelIndex(label) == -1)	// not already selected, so select
			{
				_self.selectedLabels_clearAll();
				_self.selectedLabels_addLabel(label);
			}
			else									// already selected, so remove
				_self.selectedLabels_clearAll();					
		}
		else	// case: more than one selected cell
		{
			_self.selectedLabels_clearAll();
			_self.selectedLabels_addLabel(label);
		}
	}
};

GridDevices.prototype.filterData = function ()
{
	this.filteredData = [[],[]];
	for(var ind=0; ind<2; ind++)
	{
		var filterText = this.filters[ind];
		var regExp = new RegExp(filterText, 'i');
		
		for(var i=0; i<this.data[ind].length; i++)
		{
			var dev = this.data[ind][i];
			if( regExp.test(dev.name) ) { 
				this.filteredData[ind].push(dev);
			}
		}
	}
};

//functions used for sorting alphabetically
GridDevices.prototype.compareLabel = function (devA, devB) 
{
	var a = devA.name.toUpperCase();
	var b = devB.name.toUpperCase();
	return a.localeCompare(b);
};

/**
 * Handlers for manipulating the array of selected cells
 */
GridDevices.prototype.selectedLabels_addLabel = function(label){
	label.classList.add('label_selected');			
	this.selectedLabels.push(label);
};
GridDevices.prototype.selectedLabels_removeLabel = function(label){
	var index = this.selectedLabels_getLabelIndex(label);
	if(index > -1){
		label.classList.remove('label_selected');
		this.selectedLabels.splice(index, 1);				
	}
};
GridDevices.prototype.selectedLabels_getLabelIndex = function (label){
	var index = -1;
	for(var i=0; i<this.selectedLabels.length; i++)
	{
		if (this.selectedLabels[i].id == label.id){
			index = i;
			break;
		}
	}
	return index;
	//return this.selectedLabels.indexOf(label);	// not sure but might be dangerous 
};
GridDevices.prototype.selectedLabels_clearAll = function (){
	for(var i=0; i<this.selectedLabels.length; i++)
		this.selectedLabels[i].classList.remove('label_selected');
	this.selectedLabels.length=0;	//clears the array
};
GridDevices.prototype.selectedLabels_restore = function (labels)
{
	if(labels)
		this.selectedLabels = labels;
};
GridDevices.prototype.onCellClick = function(evt, _self)
{
	this.selectedLabels_clearAll();
	GridSVG.prototype.onCellClick(evt, _self);
};
