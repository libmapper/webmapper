function ViewSelector(container) {
    this._container = container;
}

ViewSelector.prototype = {
    // Initialize the Top Menu Bar Component
    init : function() {
        var _self = this;   // to pass to context of THIS to event handlers

        $(this._container).append(
            "<div id='viewSelectorDiv' class='topMenu' style='width:150px;'>"+
                "<div class='topMenuTitle'><strong>VIEW</strong></div>"+
                "<div class='topMenuContainer' style='padding:0px'>"+
                    "<div>"+
                        "<div id='chordButton' class='viewButton viewButtonsel'></div>"+
                        "<div id='listButton' class='viewButton'></div>"+
                        "<div id='gridButton' class='viewButton'></div>"+
                        "<div id='canvasButton' class='viewButton'></div>"+
                    "</div>"+
                    "<div>"+
                        "<div id='graphButton' class='viewButton'></div>"+
                        "<div id='hiveButton' class='viewButton'></div>"+
                        "<div id='parallelButton' class='viewButton'></div>"+
//                        "<div id='balloonButton' class='viewButton'></div>"+
//                        "<div id='linkButton' class='viewButton'></div>"+
                    "</div>"+
                "</div>"+
            "</div>");
    },
};
