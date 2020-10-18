class SignalFilter{
    constructor(container, graph, viewManager) {
        this.container = container;
        this.graph = graph;
        this.viewManager = viewManager;
        $(this.container).append(
            "<div id='signalFilterDiv' class='topMenu half' style='width:310px'>"+
                "<div class='topMenuTitle half'><strong>FILTER</strong></div>"+
                "<div class='topMenuContainer'>"+
                    "<div>Sources: "+
                        "<input type='search' id='srcSearch' style='width:calc(100% - 85px);float:right');'></input>"+
                    "</div>"+
                    "<div>Destinations: "+
                        "<input type='search' id='dstSearch' style='width:calc(100% - 85px);float:right'></input>"+
                    "</div>"+
                "</div>"+
            "</div>");
        
        let self = this;
        $('#srcSearch, #dstSearch').on({
            keydown: function(e) {
                e.stopPropagation();
                if (e.metaKey == true) {
                    e.preventDefault();
                    if (e.which == 70) {
                        // remove focus
                        $(this).blur();
                        self.activate();
                    }
                }
                // check enter or escape
                else if (e.which == 13 || e.which == 27) {
                    // remove focus
                    $(this).blur();
                }
            },
            input: function(e) {
                let id = e.currentTarget.id;
                viewManager.filterSignals(id, $('#'+id).val());
            },
        });
    }

    activate() {
        if (this.viewManager.currentView != 'chord')
            $('#srcSearch').focus();
    }
}
