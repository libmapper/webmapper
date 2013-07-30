function GridSignals(){};
GridSignals.prototype = new GridSVG;
GridSignals.prototype.constructor = GridSignals; 


GridSignals.prototype.refresh = function ()
{
	$('#svgGrid' + this.gridIndex).empty();
	$('#svgRows' + this.gridIndex).empty();
	$('#svgCols' + this.gridIndex).empty();
	
	this.cells.length = 0;
	this.nCellIds = 0;
	this.nRows = 0;
	this.nCols = 0;

	this.contentDim[0] = this.filteredData[0].length*(this.cellDim[0]+this.cellMargin);
	this.contentDim[1] = this.filteredData[1].length*(this.cellDim[1]+this.cellMargin);

	this.filteredData[0].sort(this.compareLabel);
	this.filteredData[1].sort(this.compareLabel);
	
	// when autozoom is on, strech to fit into canvas
	// must be done first to set the font size
	if(this.autoZoom && this.contentDim[0] > 0 && this.contentDim[1] > 0)
	{
		var originalDim = this.vboxDim[0];	//keep original dimension for calculating zoom of font
		this.vbox = [0, 0];		// place viewbox at origin 
		
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
		
		// extra data for signals
		if(dev.device_name)
		{
			name = dev.device_name + name; 	// signals also have a device name, important for making connections
			label.setAttribute("data-device_name", dev.device_name);
			label.setAttribute("data-direction", dev.direction);					
			label.setAttribute("data-length", dev.length);
		}
		
		label.setAttribute("id", "colLabel" + this.nCols  );
		label.setAttribute("data-src", name);
		label.setAttribute("data-col", this.nCols);
		label.setAttribute("font-size", this.fontSize + "px");
		label.setAttribute("class", "label");
		label.setAttribute("text-anchor", "end");
		
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
		
		// extra data for signals
		if(dev.device_name)
		{
			name = dev.device_name + name; 	// signals also have a device name, important for making connections
			label.setAttribute("data-device_name", dev.device_name);
			label.setAttribute("data-direction", dev.direction);					
			label.setAttribute("data-length", dev.length);
		}
		
		label.setAttribute("id", "rowLabel" + this.nRows);
		label.setAttribute("data-dst", name);
		label.setAttribute("data-row", this.nRows);
		label.setAttribute("font-size", this.fontSize + "px");
		label.setAttribute("class","label");
		label.setAttribute("text-anchor", "end");
		
		// pad slashes in namespace to make label easier to read
		var patt = /\//g;
		var nameFormatted = name.replace(patt, " / ");
		
		// tooltip for long names
		var tooltip = document.createElementNS(this.svgNS,"title");
		tooltip.textContent = nameFormatted;
		label.appendChild(tooltip); 	

		
		label.appendChild(document.createTextNode(nameFormatted.toString()));	
		this.svgRowLabels.appendChild(label);
		
		label.setAttribute("x", this.rowLabelsW);
		label.setAttribute("y", (this.nRows)*(this.cellDim[1]+this.cellMargin) + Math.floor(this.cellDim[1]/2) + 1);	// I don't know why +1... getBBox doesn't really work well

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
			
			// extra data for signals grid
			if(rowLabel.getAttribute("data-device_name"))
				cell.setAttribute("data-dst_device_name", rowLabel.getAttribute("data-device_name"));
			if(colLabel.getAttribute("data-device_name"))
				cell.setAttribute("data-src_device_name", colLabel.getAttribute("data-device_name"));
			// disable cells with different signal lengths
			if(rowLabel.getAttribute("data-length") && colLabel.getAttribute("data-length") && rowLabel.getAttribute("data-length") != colLabel.getAttribute("data-length"))
				cell.setAttribute("defaultClass","cell_disabled");
			
			// set the default style class 
			// used for example, when reverting from mouseover style
			cell.setAttribute("class", cell.getAttribute("defaultClass"));
			
			// set the selected cells
			// FIX part 2/3: This is dangerous. The selectedCells arraw points to a DOM element that were removed with empty 
			// but it seems that all the attributes are still stored in the this.selectedCells
			// so I check if the created cell has the same src/dst and the reset the selected cell
			// should be fixed by storing srn/dst identifiers instead of reference to the actual cell
			for (var k=0; k<this.selectedCells.length; k++)
			{
				var c = this.selectedCells[k];
				if (c.getAttribute("data-src") == src && c.getAttribute("data-dst") == dst)
				{
					newSelected.push(cell);
				}
			}
			this.svg.appendChild(cell);
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

	if(this.mousedOverCell)
	{
		this.triggerMouseOver(this.mousedOverCell);
	}

	this.updateViewBoxes();
	this.updateZoomBars();
};

GridSignals.prototype.filterData = function ()
{
	this.filteredData = [[],[]];
	for(var ind=0; ind<2; ind++)
	{
		var filterText = this.filters[ind];
		var regExp = new RegExp(filterText, 'i');
		
		for(var i=0; i<this.data[ind].length; i++)
		{
			var sig = this.data[ind][i];
			if( regExp.test(sig.name) || regExp.test(sig.device_name)) { 
				this.filteredData[ind].push(sig);
			}
		}
	}
};

//functions used for sorting alphabetically
GridSignals.prototype.compareLabel = function (devA, devB) 
{
	var a = devA.device_name.toUpperCase() + devA.name.toUpperCase();
	var b = devB.device_name.toUpperCase() + devB.name.toUpperCase();
	return a.localeCompare(b);
};

