class SignalFilter{
    constructor(container, database, viewmanager) {
        this.container = container;
        this.database = database;
        $(this.container).append(
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
        
        let self = this;
        $('#srcSearch, #dstSearch').on('input', function(e) {
            e.stopPropagation();
            let id = e.currentTarget.id;
            viewmanager.filterSignals(id, $('#'+id).val());
        });
    }
}
