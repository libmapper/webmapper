/**
 * Parent Class for Grid Objects
 */

function GridSVG()
{
	this.svgNS = "http://www.w3.org/2000/svg";
	this.svgNSxlink = "http://www.w3.org/1999/xlink";
	this.svg;			// holding <SVG> elements for easy reference
	this.svgRowLabels;
	this.svgColLabels;	 
	this.cells = new Array();
	
	this.colsArray = new Array();
	this.rowsArray = new Array();
	this.connectionsArray = new Array();
	
	this.scrollBarDim = [30,30];
	this.svgMinDim = [33, 33];	
	this.rowLabelsW = 200;
	this.colLabelsH = 150;
	this.svgDim = []; 	// x-y dimensions of the svg canvas
	this.aspect;		// aspect ratio of SVG viewbox (for zooming)
	this.aspectCol;		// aspect ratio of col viewbox (for zooming)
	this.aspectRow;		// aspect ratio of row viewbox (for zooming)
	this.vboxPos = [0, 0];									// vbox x-y position
	this.cellDim = [32, 32];								// cell width-height dimensions
	this.cellRoundedCorner = 0;								// cell rounded corners radius
	this.cellMargin = 1;									// margin between cells
	this.labelMargin = 10;									// offset for source signal labels
	this.zoomIncrement = 50;							
	this.handleClicked; this.handleClick; this.handleValues;	// helpers for zooming scroll bars
	this.nCellIds = 0;											// helper for generating cell IDs	
	this.fontSize = 12;
	this.vboxMinDim = [ 50,50 ];		// vbox width-height dimensions
	this.selectedCells = []; 					// holds a reference to the selected cells
	this.mousedOverCell = null;					// hold a reference to the cell that's moused over
	this.nRows = 0;											// number of rows in grid (destination signals)
	this.nCols = 0;											// number of columns in grid (source signals)
	this.contentDim = [0, 0];								// width-height dimension of full content
	this.autoZoom = true;
//			this.vboxMaxDim = [3000, 3000];		// *not used in zoom scroll bars
//			this.svgMaxDim = [600, 800];	
};




GridSVG.prototype = {
		
		preInit : function (container, model, gridIndex)
		{	

			this.model = model;
			this.gridIndex = gridIndex;
			this._container = container;
			this.initDimensions(container);
			this.vboxDim = [ this.svgDim[0], this.svgDim[1] ];		// vbox width-height dimensions
			
			this.init();
		}, 
		
		initDimensions : function (container)
		{
			var w = $(container).width();
			var h = $(container).height() - 50 - $(".buttonBar").height();
			this.svgDim[0] = w - this.rowLabelsW - this.scrollBarDim[0] - this.labelMargin;	// dimensions of the svg canvas
			this.svgDim[1] = h - this.colLabelsH - this.scrollBarDim[1] - this.labelMargin;	// dimensions of the svg canvas
		
			// ensure SVG Canvas has min dimensions
			this.svgDim[0] = Math.max(this.svgDim[0], this.svgMinDim[0]);
			this.svgDim[1] = Math.max(this.svgDim[1], this.svgMinDim[1]);
		
			this.aspect = this.svgDim[0]/this.svgDim[1];			// aspect ratio of SVG viewbox (for zooming)
			this.aspectCol = this.svgDim[0]/this.colLabelsH;		// aspect ratio of col viewbox (for zooming)
			this.aspectRow = this.rowLabelsW/this.svgDim[1];		// aspect ratio of row viewbox (for zooming)
		},
		init : function () 
		{ 
			$(this._container).empty();
			
			var div;
			var _self = this;	// to pass to the instance of LibMApperMatrixView to event handlers
			
			// button bar
			div = document.createElement("div");
			div.setAttribute("class", "buttonBar");
			
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

			//zoom to fit button
			btn = document.createElement("button");
			btn.innerHTML = "Zoom to fit";
			btn.addEventListener("click", function(evt){
				_self.autoZoom = true;
				_self.vboxPos = [0,0];
				_self.refresh();
			});
			div.appendChild(btn);
			
			//connection buttons
			btn = document.createElement("button");
			btn.innerHTML = "Connect";
			btn.addEventListener("click", function(evt){
				_self.connect();
			});
			div.appendChild(btn);
			
			btn = document.createElement("button");
			btn.innerHTML = "Disconnect";
			btn.addEventListener("click", function(evt){
				_self.disconnect();
			});
			div.appendChild(btn);
			
			btn = document.createElement("button");
			btn.innerHTML = "Toggle";
			btn.addEventListener("click", function(evt){
				_self.toggleConnection();
			});
			div.appendChild(btn);
			
			this._container.appendChild(div);

			
			
			// svg column labels
			this.svgColLabels = document.createElementNS(this.svgNS, "svg");
			this.svgColLabels.setAttribute("id", "svgCols" + this.gridIndex);
			this.svgColLabels.setAttribute("xmlns", this.svgNS);
			this.svgColLabels.setAttribute("xmlns:xlink", this.svgNSxlink);
			this.svgColLabels.setAttribute("width", this.svgDim[0]);
			this.svgColLabels.setAttribute("height", this.colLabelsH);
			this.svgColLabels.setAttribute("style", "float: left; clear:both; margin-left:"+ (this.rowLabelsW + 30).toString() + "px; margin-bottom: " + this.labelMargin +"px");
			this.svgColLabels.setAttribute("preserveAspectRatio", "none");
			this._container.appendChild(this.svgColLabels);
			
			//horizontal scrollbar 
			div = document.createElement("div");
			div.setAttribute("id", "hZoomSlider" + this.gridIndex);
			div.setAttribute("style", "position: relative; margin-top: 10px; clear:both; margin-left: " + (this.rowLabelsW+38).toString() + "px");
			this._container.appendChild(div);
			
			// a wrapper div to hold vscroll, grid + row labels
			var wrapper1 = document.createElement("div");
			wrapper1.setAttribute("style", "margin-top: 5px; clear: both;");
			
			// svg row labels
			this.svgRowLabels = document.createElementNS(this.svgNS, "svg");
			this.svgRowLabels.setAttribute("id", "svgRows" + this.gridIndex);
			this.svgRowLabels.setAttribute("xmlns", this.svgNS);
			this.svgRowLabels.setAttribute("xmlns:xlink", this.svgNSxlink);
			this.svgRowLabels.setAttribute("width", this.rowLabelsW);
			this.svgRowLabels.setAttribute("height", this.svgDim[1]);
			this.svgRowLabels.setAttribute("style", "float:left; margin-right: " + this.labelMargin +"px");
			this.svgRowLabels.setAttribute("preserveAspectRatio", "none");
			wrapper1.appendChild(this.svgRowLabels);
			
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
			
			this._container.appendChild(wrapper1);
			
			this.initHorizontalZoomSlider($("#hZoomSlider" + this.gridIndex));
			this.initVerticalZoomSlider($("#vZoomSlider" + this.gridIndex));
			
			
			
		},

		initHorizontalZoomSlider : function ()
		{
			var _self = this;
			$("#hZoomSlider" + this.gridIndex).width(this.svgDim[0]);
			$( "#hZoomSlider" + this.gridIndex).slider({
				range: true,
				min: 0,
				max: 100,
				values: [ 0, 50 ],
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
			cell.setAttribute("defaultClass","cell_up");


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
						else if(evt.type == "mouseout"){
							curCell.setAttribute("class",className + curCell.getAttribute("defaultClass"));
						}
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
		
			
			// if COMMAND key is pressed, user is adding/removing to selection
			
			if(evt.metaKey)	// COMMAND key on MAC, CONTROL key on PC
			{
				if(_self.selectedCells_getCellIndex(cell) == -1)	// not already selected
					_self.selectedCells_addCell(cell);
				else
					_self.selectedCells_removeCell(cell);
			}
			
			// if COMMAND is not pressed, then user is selecting a single cell
			
			else
			{
				if(_self.selectedCells.length == 0)		// case: no selected cell
				{
					_self.selectedCells_addCell(cell);
				}
				else if(_self.selectedCells.length == 1)		// case: one selected cell
				{
					if(_self.selectedCells_getCellIndex(cell) == -1)	// not already selected, so select
					{
						_self.selectedCells_clearAll();
						_self.selectedCells_addCell(cell);
					}
					else									// already selected, so remove
						_self.selectedCells_clearAll();					
				}
				else	// case: more than one selected cell
				{
					_self.selectedCells_clearAll();
					_self.selectedCells_addCell(cell);
				}
			}
			
			$(this._container).trigger("updateConnectionProperties");
			
			// load cell details into info PANE
			//
			// ...
		
		},
		
		/**
		 * Handlers for manipulating the array of selected cells
		 */
		selectedCells_addCell : function(cell){
			cell.classList.add('cell_selected');			
			this.selectedCells.push(cell);
		},
		selectedCells_removeCell : function(cell){
			var index = this.selectedCells_getCellIndex(cell);
			if(index > -1){
				cell.classList.remove('cell_selected');
				this.selectedCells.splice(index, 1);				
			}
		},
		selectedCells_getCellIndex : function (cell){
			var index = -1;
			for(var i=0; i<this.selectedCells.length; i++)
			{
				if (this.selectedCells[i].id == cell.id){
					index = i;
					break;
				}
			}
			return index;
			//return this.selectedCells.indexOf(cell);	// not sure but might be dangerous 
		},
		selectedCells_clearAll : function (){
			for(var i=0; i<this.selectedCells.length; i++)
				this.selectedCells[i].classList.remove('cell_selected');
			this.selectedCells.length=0;	//clears the array
		},
		selectedCells_restore : function (cells)
		{
			if(cells)
				this.selectedCells = cells;
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
					// if sliders are over extended, use the zoom in function until sliders are useable
					if(_self.vboxDim[ind] - this.zoomIncrement > _self.contentDim[ind])
					{
						var inc = _self.contentDim[ind] - w;
						_self.zoomIn();
						return false;
					}
					else
					{
						this.autoZoom = false;
						
						//font size stuff
						var ratio = (_self.vboxDim[ind] - w) / _self.vboxDim[ind];
						this.fontSize = this.fontSize - (this.fontSize*ratio);
						
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
						this.refresh();  //bad to redraw everything but needed for now to change font size
//						_self.updateViewBoxes();
//						_self.updateZoomBars();
					}
					
					
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
				this.autoZoom = false;
				var ratio = this.zoomIncrement/this.vboxDim[0];
				this.fontSize = this.fontSize - (this.fontSize*ratio);
				
				this.vboxDim[0] -= this.zoomIncrement;
				this.vboxDim[1] -= this.zoomIncrement/this.aspect;
				this.refresh();  //bad to redraw everything but needed for now to change font size
//				this.updateViewBoxes();
//				this.updateZoomBars();
			}
		},
		
		zoomOut : function()
		{
			this.autoZoom = false;
		
			var ratio = this.zoomIncrement/this.vboxDim[0];
			this.fontSize = this.fontSize + (this.fontSize*ratio);
			
//			if(this.vboxDim[0] <= this.contentDim[0]-this.zoomIncrement && this.vboxDim[0] < this.vboxMaxDim[0]-this.zoomIncrement){
			if(true){
				this.vboxDim[0] += this.zoomIncrement;
				this.vboxDim[1] += this.zoomIncrement/this.aspect;
			}
			else{
				//this.vboxDim[0] = (this.contentDim[0]<this.vboxMaxDim[0])? this.contentDim[0] : this.vboxMaxDim[0];
				ratio = ( this.contentDim[0] - this.vboxDim[0] ) / this.vboxDim[0];	// special zoom increment when reaching max
				this.vboxDim[0] = this.contentDim[0];
				this.vboxDim[1] = this.vboxDim[0]/this.aspect; //this.contentDim[0]/this.aspect;
			}
			this.refresh();  //bad to redraw everything but needed for now to change font size
			//this.updateViewBoxes();
			//this.updateZoomBars();
		},
		
		makeActiveGrid : function(){
			$(this._container).trigger("makeActiveGrid", this.gridIndex);
		},
		
		keyboardHandler: function (e)
		{
			 
			if(this.nCols == 0 || this.nRows == 0)
				return;
		
			// enter or space to toggle a connection
			if(e.keyCode == 13 || e.keyCode == 32)	
			{
				if(this.selectedCells.length > 0)
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
				if(this.selectedCells.length > 0)	// only move the selected cell if there was a previously selected cell
				{
					var m = 1;	// cell jump size
					if (e.shiftKey === true)
						m=3;					// if shift key is pressed, increase the jump size;
					
					// get position of the currently selected cell
					var lastSelected = this.selectedCells[this.selectedCells.length-1];
					var currentPos = [parseInt(lastSelected.getAttribute('data-row')), parseInt(lastSelected.getAttribute('data-col'))];

					// clear all selected cells when arrows are pressed
					this.selectedCells_clearAll();
					

					
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
					var newCell = this.getCellByPos(newPos[0], newPos[1]);
					this.selectedCells_addCell(newCell);
					
					// calculate if new selected cell is visible or if it is out of view
					// if out of view then move the viewbox
					var row = newCell.getAttribute("data-row");
					var col = newCell.getAttribute("data-col");
					var cellW = this.cellDim[0]+this.cellMargin;
					var cellH = this.cellDim[1]+this.cellMargin;
					var pos = [cellW*col, cellH*row];
					
					var dim; 	// helper for code re-useability, set in switch statement following (0=left/right=x, 1=up/down=y)
					if(e.keyCode == 37 || e.keyCode == 39)	// left or right
						dim = 0;
					else if(e.keyCode == 38 || e.keyCode == 40)	// up or down
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
			this.svgColLabels.setAttribute("viewBox", this.toViewBoxString(this.vboxPos[0], this.colLabelsH - (this.vboxDim[0]/this.aspectCol), this.vboxDim[0], this.vboxDim[0]/this.aspectCol));
			this.svgRowLabels.setAttribute("viewBox", this.toViewBoxString(this.rowLabelsW - (this.vboxDim[1]*this.aspectRow), this.vboxPos[1], this.vboxDim[1]*this.aspectRow, this.vboxDim[1]));
		},
		
		/**
		 * reset values of each zoombar based on updated content or viewbox
		 */
		updateZoomBars : function ()
		{
			if (this.contentDim[0] == 0)
				$("#hZoomSlider" + this.gridIndex).slider( "disable" );
			else{
				$("#hZoomSlider" + this.gridIndex).slider( "enable" );
				$("#hZoomSlider" + this.gridIndex).slider("option", "min", 0);
				$("#hZoomSlider" + this.gridIndex).slider("option", "max", this.contentDim[0]);
				$("#hZoomSlider" + this.gridIndex).slider( "option", "values", [ this.vboxPos[0], this.vboxPos[0]+this.vboxDim[0]]);
			}
			
			if (this.contentDim[1] == 0)
				$("#vZoomSlider" + this.gridIndex).slider( "disable" );
			else{
				$("#vZoomSlider" + this.gridIndex).slider( "enable" );
				$("#vZoomSlider" + this.gridIndex).slider("option", "min", 0);
				$("#vZoomSlider" + this.gridIndex).slider("option", "max", this.contentDim[1]);
				$("#vZoomSlider" + this.gridIndex).slider( "option", "values", [this.contentDim[1]-(this.vboxPos[1]+this.vboxDim[1]), this.contentDim[1]-this.vboxPos[1]]);
			}
		},
		
		updateDisplayData: function (colsArray, rowsArray, connectionsArray)
		{
			this.colsArray = colsArray;
			this.rowsArray = rowsArray;
			this.connectionsArray = connectionsArray;
		},
		
		refresh : function ()
		{
			alert("should not reach here, overridden method");
			
			// set style of cells if the mouse is over a cell
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
		},
		
		/**
		 * toggles a connection
		 * checks if the cell already has a connection then toggles
		 */
		
		toggleConnection : function()
		{
			if(this.selectedCells.length == 0)	
				return;
			
			for (var i=0; i<this.selectedCells.length; i++)
			{
				var cell = this.selectedCells[i];
				$(this._container).trigger("toggleConnection", cell);
			}
		},
		connect : function()
		{
			if(this.selectedCells.length == 0)	
				return;
			
			for (var i=0; i<this.selectedCells.length; i++)
			{
				var cell = this.selectedCells[i];
				$(this._container).trigger("connect", cell);
			}
		},
		disconnect : function()
		{
			if(this.selectedCells.length == 0)	
				return;
			
			for (var i=0; i<this.selectedCells.length; i++)
			{
				var cell = this.selectedCells[i];
				$(this._container).trigger("disconnect", cell);
			}
		},
		getSelectedCells : function()
		{
				return this.selectedCells;
		}
		
		
		
		
};





