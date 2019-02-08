function SaverLoader(container, database) {
    this._container = container;
    this.database = database;
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
                    "<div id='loadButton'>Open</div>"+
                "</div>"+
            "</div>");
     
        // TODO: add "save as" option
        $('#saveButton').on('click', function(e) {
            e.stopPropagation();
            let file = database.exportFile();
            if (!file)
                return;

            let link = document.createElement('a');
            let blob = new Blob([JSON.stringify(file, null, '\t')]);
            let url = URL.createObjectURL(blob);
            link.href = url;
            link.setAttribute('download', 'mapping.json');
            link.click();
        });

        $('#loadButton').click(function(e) {
            e.stopPropagation();
            input.trigger("click"); // open dialog
        });
    },
};
