class NetworkSelector {
    constructor(container, graph, view) {
        this.graph = graph;
        this.selected = graph.networkInterfaces.selected;

        $(container).append(
            "<div id='netSelectorDiv' class='topMenu half' style='width:75px;overflow:visible'>"+
                "<div class='topMenuTitle half'><strong>NET</strong></div>"+
                "<div class='topMenuContainer' style='padding:5px;overflow:visible'>"+
                    "<div id='ifaceMenuLabel' style='padding:5px'>lo0</div>"+
                            "<table id='ifaceMenu' class='dropdown-content' style='right:0px;min-width:55px'>"+
                        "<tbody><tr><td>lo0</td></tr><tr><td>en1</td></tr></tbody>"+
                    "</table>"+
                "</div>"+
            "</div>");

        $('#ifaceMenuLabel').on('click', function(e) {
            let menu = $('#ifaceMenu');
            if ($(menu).hasClass('show')) {
                $(menu).removeClass('show');
                $(menu).find('td').off('click');
                return;
            }
            $(menu).addClass('show');

            $(menu).find('td').one('click', function(td) {
                $(menu).removeClass('show');
                let iface = td.currentTarget.innerHTML;
                // send iface selection to backend
                command.send('select_interface', iface);
            });
            e.stopPropagation();
        });
    }

    update() {
        $('#ifaceMenu').empty();
        for (var i in this.graph.networkInterfaces.available) {
            let iface = this.graph.networkInterfaces.available[i];
            if (iface == this.graph.networkInterfaces.selected)
                iface = "<tr><td class='tdsel'>"+iface+"</td></tr>";
            else
                iface = "<tr><td>"+iface+"</td></tr>";
            $('#ifaceMenu').append(iface);
        }
        if (this.selected != null && this.selected != this.graph.networkInterfaces.selected) {
            location.reload();
        }
        this.selected = this.graph.networkInterfaces.selected;
        $('#ifaceMenuLabel').text(this.selected);
    }
}
