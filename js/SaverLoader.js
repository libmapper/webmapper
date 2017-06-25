function SaverLoader(container, model) {
    this._container = container;
    this.model = model;
}

SaverLoader.prototype = {
    // Initialize the Top Menu Bar Component
    init : function() {
        var _self = this;   // to pass to context of THIS to event handlers

        $(this._container).append(
            "<div id='saverLoaderDiv' class='topMenu' style='width:75px;'>"+
                "<div class='topMenuTitle'><strong>FILE</strong></div>"+
                "<div class='topMenuContainer'>"+
                    "<div id='saveButton'>Save</div>"+
                    "<div id='loadButton'>Load</div>"+
                "</div>"+
            "</div>");
    },
};
