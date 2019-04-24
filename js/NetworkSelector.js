class NetworkSelector {
    constructor(container, database, view) {
        this.database = database;
        this.selected = database.networkInterfaces.selected;

        $(container).append(
            "<div id='netSelectorDiv' class='topMenu' style='width:75px;overflow:visible'>"+
                "<div class='topMenuTitle'><strong>NET</strong></div>"+
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
                command.send('select_network', iface);
            });
            e.stopPropagation();
        });
    }

    update() {
        $('#ifaceMenu').empty();
        for (var i in this.database.networkInterfaces.available) {
            let iface = this.database.networkInterfaces.available[i];
            if (iface == this.database.networkInterfaces.selected)
                iface = "<tr><td class='tdsel'>"+iface+"</td></tr>";
            else
                iface = "<tr><td>"+iface+"</td></tr>";
            $('#ifaceMenu').append(iface);
        }
        if (this.selected != null && this.selected != this.database.networkInterfaces.selected) {
            location.reload();
        }
        this.selected = this.database.networkInterfaces.selected;
//        $('#ifaceMenuLabel').text("▶ "+this.selected);
        $('#ifaceMenuLabel').text(this.selected);
    }
}
