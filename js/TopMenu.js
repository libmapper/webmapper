function TopMenu(container, model)
{
	this._container = container;
	this.model = model;

}

BalloonView.prototype = {
		
		/**
		 * Initialize the component
		 */
		init : function () 
		{ 
			var _self = this;				// to pass to the instance of balloon.js to event handlers
			var wrapperDiv, div, btn;		// to instantiate items
			
			// clear the container DIV
			$(this._container).empty();

		}
}