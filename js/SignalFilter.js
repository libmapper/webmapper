function SignalFilter(container, database) {
    this._container = container;
    this.database = database;
}

SignalFilter.prototype = {
    // Initialize the Top Menu Bar Component
    init : function() {
        var _self = this;   // to pass to context of THIS to event handlers

//        $(this._container).empty();        // clear the container DIV

        $(this._container).append(
            "<div id='signalFilterDiv' class='topMenu' style='width:calc(25% - 75px);'>"+
                "<div class='topMenuTitle'><strong>FILTER</strong></div>"+
                "<div class='topMenuContainer'>"+
                    "<div>Sources: "+
                        "<input type='search' id='srcSearch' style='float:right; width:calc(100% - 85px);'></input>"+
                    "</div>"+
                    "<div>Destinations: "+
                        "<input type='search' id='dstSearch' style='float:right; width:calc(100% - 85px);'></input>"+
                    "</div>"+
                "</div>"+
            "</div>");
    },
};
