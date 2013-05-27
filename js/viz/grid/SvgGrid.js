function SvgGrid(container, model, gridIndex){
	
	this.model = model;
	
	this.rowsArray = new Array();
	this.colsArray = new Array();

//	this.dataArray = dataArray;
//	this.connectionsArray = connectionsArray;
	
	this.svg;
	this.svgRowLabels;
	this.svgColLabels;	// holding <SVG> elements for easy reference 
	this.svgNS = "http://www.w3.org/2000/svg";
	this.svgNSxlink = "http://www.w3.org/1999/xlink";

	this._container = $(container);
	this.cells = new Array();

	this.svgDim = [400, 400];								// x-y dimensions of the svg canvas
	this.colLabelsH = 200;
	this.rowLabelsW = 200;
	
	this.zoomIncrement = 50;							
	this.aspect = this.svgDim[0]/this.svgDim[1];			// aspect ratio of SVG viewbox (for zooming)
	this.aspectCol = this.svgDim[0]/this.colLabelsH;		// aspect ratio of col viewbox (for zooming)
	this.aspectRow = this.rowLabelsW/this.svgDim[1];		// aspect ratio of row viewbox (for zooming)
	
	this.vboxDim = [ this.svgDim[0], this.svgDim[1] ];		// vbox width-height dimensions
	this.vboxPos = [0, 0];									// vbox x-y position
	this.vboxMinDim = [50, 50];							// vbox minimum width-height dimensions
	this.vboxMaxDim = [3000, 3000];		// *not used in zoom scroll bars
	
	this.cellDim = [32, 32];								// cell width-height dimensions
	this.cellRoundedCorner = 0;								// cell rounded corners radius
	this.cellMargin = 1;									// margin between cells
	this.labelMargin = 5;									// offset for source signal labels
	
	this.selectedCell = null; 					// hold a reference to the selected cell
	this.mousedOverCell = null;					// hold a reference to the cell that's moused over

	this.nRows = 0;											// number of rows in grid (destination signals)
	this.nCols = 0;											// number of columns in grid (source signals)
	this.contentDim = [0, 0];								// width-height dimension of full content
	
	this.gridIndex = gridIndex;

	this.init(container);
	this.initHorizontalZoomSlider($("#hZoomSlider" + this.gridIndex));
	this.initVerticalZoomSlider($("#vZoomSlider" + this.gridIndex));
	
	this.handleClicked; this.handleClick; this.handleValues;	// helpers for zooming scroll bars
	this.nCellIds = 0;											// helper for generating cell IDs
	
	
}

SvgGrid.prototype = {
		
		init : function (container) 
		{ 
			var div;
			var _self = this;	// to pass to the instance of LibMApperMatrixView to event handlers
			
			// button bar
			div = document.createElement("div");
			div.setAttribute("id", "buttonBar");
			div.setAttribute("style", "margin-bottom: 5px; margin-left: 16px; width: 200px;");
			
			var btn;
			
			//zoom in button
			btn = document.createElement("button");
			btn.innerHTML = "+";
			btn.addEventListener("click", function(evt){
				_self.zoomIn();
			});
			div.appendChild(btn);
				
			//zoom out button
			btn = document.createElement("button");
			btn.innerHTML = "-";
			btn.addEventListener("click", function(evt){
				_self.zoomOut();
			});
			div.appendChild(btn);
				
			//toggle connection button
			btn = document.createElement("button");
			btn.innerHTML = "Toggle";
			btn.addEventListener("click", function(evt){
				_self.toggleConnection();
			});
			div.appendChild(btn);
			
			container.appendChild(div);
			
			//horizontal scrollbar 
			div = document.createElement("div");
			div.setAttribute("id", "hZoomSlider" + this.gridIndex);
			div.setAttribute("style", "position: relative; margin-top: 10px; clear:both;");
			container.appendChild(div);
			
			// a wrapper div to hold vscroll, grid + row labels
			var wrapper1 = document.createElement("div");
			wrapper1.setAttribute("style", "margin-top: 5px; clear: both;");
			
			// vertical scrollbar
			div = document.createElement("div");
			div.setAttribute("id", "vZoomSlider" + this.gridIndex);
			div.setAttribute("style", "float:left;margin-left: 5px;");
			wrapper1.appendChild(div);
			
			// svg canvas
			this.svg = document.createElementNS(this.svgNS,"svg");
			this.svg.setAttribute("id", "svgGrid" + this.gridIndex);
			this.svg.setAttribute("xmlns", this.svgNS);
			this.svg.setAttribute("xmlns:xlink", this.svgNSxlink);
			this.svg.setAttribute("width", this.svgDim[0]);
			this.svg.setAttribute("height", this.svgDim[1]);
			this.svg.setAttribute("viewBox", this.toViewBoxString(this.vboxPos[0], this.vboxPos[1], this.vboxDim[0], this.vboxDim[1]));
			this.svg.setAttribute("preserveAspectRatio", "none");
			this.svg.setAttribute("style", "float:left;margin-left: 5px; margin-bottom: 5px");
			wrapper1.appendChild(this.svg);	
			
			// svg row labels
			this.svgRowLabels = document.createElementNS(this.svgNS, "svg");
			this.svgRowLabels.setAttribute("id", "svgRows" + this.gridIndex);
			this.svgRowLabels.setAttribute("xmlns", this.svgNS);
			this.svgRowLabels.setAttribute("xmlns:xlink", this.svgNSxlink);
			this.svgRowLabels.setAttribute("width", this.rowLabelsW);
			this.svgRowLabels.setAttribute("height", this.svgDim[1]);
			this.svgRowLabels.setAttribute("style", "float:left;");
			this.svgRowLabels.setAttribute("preserveAspectRatio", "none");
			wrapper1.appendChild(this.svgRowLabels);
			
			container.appendChild(wrapper1);
			
			// svg column labels
			this.svgColLabels = document.createElementNS(this.svgNS, "svg");
			this.svgColLabels.setAttribute("id", "svgCols" + this.gridIndex);
			this.svgColLabels.setAttribute("xmlns", this.svgNS);
			this.svgColLabels.setAttribute("xmlns:xlink", this.svgNSxlink);
			this.svgColLabels.setAttribute("width", this.svgDim[0]);
			this.svgColLabels.setAttribute("height", this.colLabelsH);
			this.svgColLabels.setAttribute("style", "float: left; clear:both; margin-left:30px;");
			this.svgColLabels.setAttribute("preserveAspectRatio", "none");
			
			container.appendChild(this.svgColLabels);
			
		},

		initHorizontalZoomSlider : function ()
		{
			var _self = this;
			$("#hZoomSlider" + this.gridIndex).width(this.svgDim[0]);
			$( "#hZoomSlider" + this.gridIndex).slider({
				range: true,
				min: 0,
				max: 100,
				values: [ 0, 100 ],
				start: function( event, ui ){
					_self.sliderClicked(event, ui, _self);
				},
				slide: function( event, ui ) 
				{
					_self.zoomSlide(_self, this.id, ui, 0, event.pageX);
					return false;
				}
			});
			$("#hZoomSlider" + this.gridIndex + " .ui-slider-handle").unbind('keydown');
		},
		
		initVerticalZoomSlider : function ()
		{
			var _self = this;
			$("#vZoomSlider" + this.gridIndex).height(this.svgDim[1]);
			$("#vZoomSlider" + this.gridIndex).slider({
			      range: true,
			      orientation: "vertical",
			      min: 0,
			      max: 100,
			      values: [ 0, 100 ],
			      start: function( event, ui )
			      {
					_self.sliderClicked(event, ui, _self);
			      },
			      slide: function( event, ui ) 
			      {
			    	  _self.zoomSlide(_self, this.id, ui, 1, event.pageY);
			    	  return false;
			      }
			  });
			 $("#vZoomSlider" + this.gridIndex + " .ui-slider-handle").unbind('keydown');
		},
		
		

		createCell : function (row, col, src, dst)
		{
			var cell = document.createElementNS(this.svgNS,"rect");
			cell.id = this.nextCellId();
			//cell.setAttribute("id", this.nextCellId());
			cell.setAttribute("data-row", row);
			cell.setAttribute("data-col", col);
			cell.setAttribute("data-src", src);
			cell.setAttribute("data-dst", dst);
			
			cell.setAttribute("x",col*(this.cellDim[0]+this.cellMargin));
			cell.setAttribute("y",row*(this.cellDim[1]+this.cellMargin));
			cell.setAttribute("rx", this.cellRoundedCorner);
			cell.setAttribute("ry", this.cellRoundedCorner);
			cell.setAttribute("width",this.cellDim[0]);
			cell.setAttribute("height",this.cellDim[1]);
			cell.setAttribute("class","cell_up");


			var _self = this;	// to pass to the instance of LibMapperMatrixView to event handlers
			cell.addEventListener("click", function(evt){
				_self.onCellClick(evt, _self);
			});
			cell.addEventListener("mouseover", function(evt){
				_self.onCellMouseOver(evt, _self);
			});
			cell.addEventListener("mouseout", function(evt){
				_self.onCellMouseOver(evt, _self);
			});
			
			_self.cells.push(cell);
			return cell;
		},
		
		/**
		 * on cell mouseover, highlights corresponding row and columns
		 * must handle special cases: if the cell is the selected cell or has a connection
		 */
		onCellMouseOver : function(evt, _self)    
		{
			// keep reference to cell mouse is over (useful in other methods)
			if(evt.type == "mouseover")
				_self.mousedOverCell = evt.target;	
			else if (evt.type == "mouseout")
				_self.mousedOverCell = null;	
				
			var selectedRow = evt.target.getAttribute("data-row");
			var selectedCol = evt.target.getAttribute("data-col");
			
			// style cells
			for(var i=0; i< this.cells.length; i++)
			{
				var curCell = this.cells[i];
				var curRow = curCell.getAttribute("data-row");;
				var curCol = curCell.getAttribute("data-col");;
				if(curRow == selectedRow || curCol == selectedCol)
				{
					var className = curCell.getAttribute("class");
					if(className.indexOf("cell_connected") == -1)
					{
						className = (className.indexOf("cell_selected") == -1)? "" : "cell_selected "; 
						if(evt.type == "mouseover")
							curCell.setAttribute("class", className + "row_over");
						else if(evt.type == "mouseout")
							curCell.setAttribute("class",className + "cell_up");
					}
				}
			}
			
			// style row label
			var rowLabel = _self.svgRowLabels.getElementById("rowLabel" + selectedRow);
			if(rowLabel != null)
			{
				if(evt.type == "mouseover")
					rowLabel.setAttribute("class","label_over");
				else if(evt.type == "mouseout")
					rowLabel.setAttribute("class","label");
			}
			
		
			// style col label
			var colLabel = _self.svgColLabels.getElementById("colLabel" + selectedCol);
			if(colLabel != null)
			{
				if(evt.type == "mouseover")
					colLabel.setAttribute("class","label_over");
				else if(evt.type == "mouseout")
					colLabel.setAttribute("class","label");
			}
		},
		
		/**
		 * on cell click, set the cell as selected
		 * handle removing the previously selected cell and the special case where the previous was null
		 */
		onCellClick : function(evt, _self)    
		{
			
			_self.makeActiveGrid();
			
			var cell = evt.target;
		
			if(_self.selectedCell == null)
			{
				// set the clicked cell as selected
				_self.selectedCell = cell;
				_self.selectedCell.classList.add('cell_selected');
			}
			else if(cell.id != _self.selectedCell.id)	
			{	
				// clear last selected cell
				_self.selectedCell.classList.remove('cell_selected');
				// set the clicked cell as selected
				_self.selectedCell = cell;
				_self.selectedCell.classList.add('cell_selected');
			}	
			else	// already selected, so deselect
			{
				//removeCellClass("cell_selected", cell);
				_self.selectedCell.classList.remove('cell_selected');
				_self.selectedCell = null;
			}
			
			
			// load cell details into info PANE
			//
			// ...
		
		},
		
		nextCellId : function (){
			return "cell" + this.gridIndex + "_" + this.nCellIds++;
		},
		
		getCellByPos : function (row, col)
		{
			for(var i=0; i<this.cells.length; i++){
				if(this.cells[i].getAttribute('data-row') == row && this.cells[i].getAttribute('data-col') == col){
					return this.cells[i];
				}
			}
			if(i==this.cells.length)
				return null;
		},
		
		/**
		 * Helper function to format the viewbox string
		 * @param x x position
		 * @param y y position
		 * @param w width
		 * @param h height
		 */
		toViewBoxString : function (x, y, w, h){
			return x.toString() + " " + y.toString() + " " + w.toString() + " " + h.toString();
		},

		
		/**
		 * helper function that customizes JQueryUI Range slider to gain scrollbar functionality 
		 * when slider is clicked, check if clicked one of the handles or the slider
		 * if slider, store the original values (need them saved otherwise slider's default functionality overrides them)
		 * and the click position (used to determine how much user has dragged the mouse)
		 */
		sliderClicked: function (e, ui, _self)
		{
			_self.handleClicked = $(e.originalEvent.target).hasClass("ui-slider-handle");	// true if clicked on handle, false for slider 
			_self.handleValues = ui.values;			// store the original values 
			_self.handleClick = [e.pageX, e.pageY];	// store the initial x/y click position
		},

		/**
		 * function that takes care of scrolling and zooming functionality for both zoom bars
		 * param ind: 0 is X dimension, 1 is Y dimension. 
		 * 	It points into any dimension array with X and Y values. 
		 * 	Note Y dimension needs special treatment because dimensions are reversed
	 	 */
		zoomSlide : function (_self, sliderID, ui, ind, mousePos)
		{
			//for when a handle is clicked (change range and zoom)
			if(_self.handleClicked)	
			{
				
				var w = ui.values[1]-ui.values[0];	// new slider width
				if(w < _self.vboxMinDim[ind] || w > _self.contentDim[ind])	// do nothing if range is less than minimum or more than content
					return false;
				else
				{
					//set the new dimensions of vbox and reposition it
					_self.vboxDim[ind] = w;		// clicked dimension size
					_self.vboxDim[1-ind] = (ind==0)? w/_self.aspect: w*_self.aspect;	// other dimension's size based on aspect ratio
					_self.vboxPos[ind] = (ind==0)? ui.values[0] : _self.contentDim[ind]-ui.values[1];	// set the vbox position based on value of first handle (reversed for Y)
					
					//if other dimension gets out of range, must adjust the vbox's position appropriately
					if(_self.vboxPos[1-ind]+_self.vboxDim[1-ind] > _self.contentDim[1-ind])
					{	 
						if(_self.vboxPos[1-ind] <= 0)	// when other dimension is at max, keep the view box at 0
							_self.vboxPos[1-ind] = 0;
						else							// when other dimension is not maxed, scroll left by the surpassed amount
						{
							var overflow = _self.contentDim[1-ind] - _self.vboxPos[1-ind] -_self.vboxDim[1-ind];
							_self.vboxPos[1-ind] += overflow;
						}
					}
					
					// update the GUI
					_self.updateViewBoxes();
					_self.updateZoomBars();
				}
			}
			// for when the range was clicked (scroll and slide)
			else	
			{
				// do nothing if scroll bars are maxed
				if(_self.vboxDim[ind] >= _self.contentDim[ind])
					return false;
				
				// calculate new values after sliding
				var mouseDiff = (ind==0)? mousePos-_self.handleClick[ind] : _self.handleClick[ind]-mousePos;	//reversed for Y
				var dx = (mouseDiff / _self.svgDim[ind]) * ( _self.contentDim[ind]-_self.vboxDim[ind]);	// drag size relative to size of the scroll bar, multiplied by scrollable range	        
				var v1 = _self.handleValues[0]+dx;	// 1st handle new value
		        var v2 = _self.handleValues[1]+dx;	// 2nd handle new value
		        
		        // fixes glitch when user scrolls with mouse fast beyond min/max by removing the excess and snapping to the min/max 
		        var overflow=0;
		        if(v1 < 0)
		        	overflow = 0 - v1;
		        else if(v2 > _self.contentDim[ind])
		        	overflow = _self.contentDim[ind] - v2;
	        	v1 += overflow;
		        v2 += overflow;

		        // update the slider's values and the vBox's position
	        	$("#" + sliderID).slider("option", "values", [v1,v2]);
	        	_self.vboxPos[ind] = (ind==0)? v1 : (_self.contentDim[ind]-_self.vboxDim[ind]) - v1;	//vertical is reversed
	        	_self.updateViewBoxes();
			}
		},
		
		zoomIn : function()
		{
			if(this.vboxDim[0] > this.vboxMinDim[0])
			{
				this.vboxDim[0] -= this.zoomIncrement;
				this.vboxDim[1] -= this.zoomIncrement/this.aspect;
				this.updateViewBoxes();
				this.updateZoomBars();
			}
		},
		
		zoomOut : function()
		{
			if(this.vboxDim[0] <= this.contentDim[0]-this.zoomIncrement && this.vboxDim[0] < this.vboxMaxDim[0]-this.zoomIncrement){
				this.vboxDim[0] += this.zoomIncrement;
				this.vboxDim[1] += this.zoomIncrement/this.aspect;
			}
			else{
				this.vboxDim[0] = (this.contentDim[0]<this.vboxMaxDim[0])? this.contentDim[0] : this.vboxMaxDim[0];
				this.vboxDim[1] = this.vboxDim[0]/this.aspect; //this.contentDim[0]/this.aspect;
			}
			this.updateViewBoxes();
			this.updateZoomBars();
		},
		
		makeActiveGrid : function(){
			this._container.trigger("makeActiveGrid", this.gridIndex);
		},
		
		keyboardHandler: function (e)
		{
			if(this.nCols == 0 || this.nRows == 0)
				return;
		
			// enter or space to toggle a connection
			if(e.keyCode == 13 || e.keyCode == 32)	
			{
				if(this.selectedCell != null)
					this.toggleConnection();
			}	
			
			// 'ctrl' + '+' to zoom in
			else if(e.keyCode == 187 && e.ctrlKey)
				this.zoomIn();
			
			// 'ctrl' + '-' to zoom out
			else if(e.keyCode == 189 && e.ctrlKey)
				this.zoomOut();
			
			// movement arrows to move the selected cell
			else if (e.keyCode == 37 || e.keyCode == 38 || e.keyCode == 39 || e.keyCode == 40)	
			{
				if(this.selectedCell != null)	// cases where there is a previously selected cell
				{
					var m = 1;	// cell jump size
					if (e.shiftKey === true)
						m=3;					// if shift key is pressed, increase the jump size;
					
					// get position of the currently selected cell 
					var currentPos = [parseInt(this.selectedCell.getAttribute('data-row')), parseInt(this.selectedCell.getAttribute('data-col'))];

					// update style to unselect the current selected cell
					this.selectedCell.classList.remove('cell_selected');
					
					// set position of the new selected cell
					var newPos = [currentPos[0], currentPos[1]];		// [row, col]... I know very confusing with X/Y coordinates
					switch(e.keyCode)	
					{
						case 37:	// left
							if(currentPos[1] > 0)
								newPos = [currentPos[0], currentPos[1]-m];
						  break;
						case 38:	// up
							if(currentPos[0] > 0)
								newPos = [currentPos[0]-m, currentPos[1]];
						  break;
						case 39:	// right
							if(currentPos[1] < this.nCols-1)
								newPos = [currentPos[0], currentPos[1]+m];
						  break;
						case 40:	// down
							if(currentPos[0] < this.nRows-1)
								newPos = [currentPos[0]+m, currentPos[1]];
						  break;
					}
					
					//ensure newPos doesn't exceed bounds
					if(newPos[0] < 0)
						newPos[0] = 0;
					else if(newPos[0] > this.nRows-1)
						newPos[0] = this.nRows-1;				
					if(newPos[1] < 0)
						newPos[1] = 0;
					else if(newPos[1] > this.nCols-1)
						newPos[1] = this.nCols-1;
					
					// set the new selected cell based on the arrow key movement
					this.selectedCell = this.getCellByPos(newPos[0], newPos[1]);

					// style the new cell as selected
					this.selectedCell.classList.add('cell_selected');
					
					// calculate if new selected cell is visible or if it is out of view
					// if out of view then move the viewbox
					var row = this.selectedCell.getAttribute("data-row");
					var col = this.selectedCell.getAttribute("data-col");
					var cellW = this.cellDim[0]+this.cellMargin;
					var cellH = this.cellDim[1]+this.cellMargin;
					var pos = [cellW*col, cellH*row];
					
					var dim; 	// helper for code re-useability, set in switch statement following (0=left/right=x, 1=up/down=y)
					if(e.keyCode == 37 || e.keyCode == 39)
						dim = 0;
					else if(e.keyCode == 38 || e.keyCode == 40)
						dim = 1;
					
					switch(e.keyCode)	
					{
						case 37:	// left
						case 39:	// right
						case 38:	// up
						case 40:	// down

							// prevent moving vbox if scrollbars are maxed
							if(this.vboxDim[dim] < this.contentDim[dim])
							{
								// off screen on left/up
								if(pos[dim] < this.vboxPos[dim] + ((m-1)*cellW))
									this.vboxPos[dim] = pos[dim] - ((m-1)*cellW);	// set the new position
									if(this.vboxPos[dim] < 0) 					// if moved to less than 0, set to 0
										this.vboxPos[dim] = 0; 
								
								// off screen on right/down
								else if(pos[dim] > this.vboxPos[dim] + this.vboxDim[dim] - (m*cellW))
									this.vboxPos[dim] = pos[dim] - this.vboxDim[dim] + (m*cellW);		// set the new position
									if(this.vboxPos[dim] > this.contentDim[dim] - this.vboxDim[dim])	// if moved outside of content, set to the max
											this.vboxPos[dim] = this.contentDim[dim] - this.vboxDim[dim];
							}
						  break;
					}
							
					this.updateViewBoxes();
					this.updateZoomBars();
				}
			}
		},
		
		updateViewBoxes : function()
		{
			this.svg.setAttribute("viewBox", this.toViewBoxString(this.vboxPos[0], this.vboxPos[1], this.vboxDim[0], this.vboxDim[1]));
			this.svgColLabels.setAttribute("viewBox", this.toViewBoxString(this.vboxPos[0], 0, this.vboxDim[0], this.vboxDim[0]/this.aspectCol));
			this.svgRowLabels.setAttribute("viewBox", this.toViewBoxString(0, this.vboxPos[1], this.vboxDim[1]*this.aspectRow, this.vboxDim[1]));
		},
		
		/**
		 * reset values of each zoombar based on updated content or viewbox
		 */
		updateZoomBars : function ()
		{
			$("#hZoomSlider" + this.gridIndex).slider("option", "min", 0);
			$("#hZoomSlider" + this.gridIndex).slider("option", "max", this.contentDim[0]);
			$("#hZoomSlider" + this.gridIndex).slider( "option", "values", [ this.vboxPos[0], this.vboxPos[0]+this.vboxDim[0]]);
			$("#vZoomSlider" + this.gridIndex).slider("option", "min", 0);
			$("#vZoomSlider" + this.gridIndex).slider("option", "max", this.contentDim[1]);
			$("#vZoomSlider" + this.gridIndex).slider( "option", "values", [this.contentDim[1]-(this.vboxPos[1]+this.vboxDim[1]), this.contentDim[1]-this.vboxPos[1]]);
		},
		
		updateDisplay : function (colsArray, rowsArray, connectionsArray){
			
			// reset everything in old view
			$('#svgGrid' + this.gridIndex).empty();
			$('#svgRows' + this.gridIndex).empty();
			$('#svgCols' + this.gridIndex).empty();
			this.cells = new Array();
			this.nCellIds = 0;
			this.nRows = 0;
			this.nCols = 0;
			
			// create column labels
			for (var index=0; index< colsArray.length; index++)
			{
				var dev = colsArray[index];

				var label = document.createElementNS(this.svgNS,"text");
				label.setAttribute("id", "colLabel" + this.nCols  );
				label.appendChild(document.createTextNode(dev.name));	
				this.svgColLabels.appendChild(label);
				var halign = (label.getBBox().height)/4 ;		//for centered alignment. *getBBox() only works if used after adding to DOM
				var xPos = ((this.nCols)*(this.cellDim[0]+this.cellMargin)+(this.cellDim[0]/2)-halign);			// I don't know why +4 
				var yPos = this.labelMargin;
				label.setAttribute("class", "label");
				label.setAttribute("data-src", dev.name);
				label.setAttribute("data-col", this.nCols);
				label.setAttribute("transform","translate(" + xPos + "," + yPos + ")rotate(90)");
				this.nCols++;
			}
			
			// create row labels
			for (var index=0; index< rowsArray.length; index++)
			{	
				var dev = rowsArray[index];
				var label = document.createElementNS(this.svgNS,"text");
				label.appendChild(document.createTextNode(dev.name));	
				this.svgRowLabels.appendChild(label);
				label.setAttribute("id", "rowLabel" + this.nRows);
				label.setAttribute("x", this.labelMargin);
				label.setAttribute("data-dst", dev.name);
				label.setAttribute("data-row", this.nRows);
				label.setAttribute("class","label");
				var valign = label.getBBox().height/2 + 2;		//BBox only works if used after adding to DOM
				label.setAttribute("y", (this.nRows)*(this.cellDim[1]+this.cellMargin)+(this.cellDim[1]-valign));	// set after added so BBox method
				this.nRows++;
			}
			
			// set the dimension variables
			this.contentDim[0] = this.nCols*(this.cellDim[0]+this.cellMargin);
			this.contentDim[1] = this.nRows*(this.cellDim[1]+this.cellMargin);
			
			// create the cells
			for(var i=0; i<this.nRows; i++){
				for(var j=0; j<this.nCols; j++)
				{
					var rowLabel = this.svgRowLabels.getElementById("rowLabel" + i);		
					var colLabel = this.svgColLabels.getElementById("colLabel" + j);	
					var src = colLabel.getAttribute("data-src");
					var dst = rowLabel.getAttribute("data-dst");
					var cell = this.createCell(i, j, src, dst);
					
					// check if it was the selected cell
					// FIX: This is dangerous. The selected cell is pointing to a DOM element that was removed with empty 
					// but it seems that all the attributes are still stored in the this.selectedCell
					// so I check if the created cell has the same src/dst and the reset the selected cell
					// should be fixed by storing srn/dst identifiers instead of reference to the actual cell
					if(this.selectedCell && this.selectedCell.getAttribute("data-src") == src && this.selectedCell.getAttribute("data-dst") == dst)
					{
						this.selectedCell = cell;
						this.selectedCell.classList.add('cell_selected');
					}
					this.svg.appendChild(cell);
				}
			}
		
			// update values for the zoom-slider bars
			
			
			// set the zoom level
			if(this.contentDim[0] == 0 || this.contentDim[1] == 0)
			{
			
			}
			
			// keeping cells as squares
			else if(this.contentDim[0] >= this.contentDim[1])
			{
				this.vboxDim[0] = this.contentDim[0];
				this.vboxDim[1] = this.vboxDim[0]/this.aspect;
			}else if(this.contentDim[1] >= this.contentDim[0]) {
				this.vboxDim[1] = this.contentDim[1];
				this.vboxDim[0] = this.vboxDim[1]*this.aspect;				
			}
			
//			this.vboxDim[0] = this.contentDim[0];
//			this.vboxDim[1] = this.contentDim[1];	

			this.updateViewBoxes();
			this.updateZoomBars();

			
			
			// create the links
			for (var i=0; i< connectionsArray.length; i++)
			{
				var s = connectionsArray[i].src_name;
				var d = connectionsArray[i].dest_name;
				
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

			
		},
		
		/**
		 * toggles a connection
		 * checks if the cell already has a connection then toggles
		 */
		
		toggleConnection : function()
		{
			if(this.selectedCell == null)	
				return;

			this._container.trigger("toggle", this.selectedCell);
		}
		
		
		
};