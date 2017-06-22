// An object for the overall display
function mapperTable(model, id, orientation, detail)
{
    var tableHeight = 0;
    var frame = null;

    // The most recently selected rows, for shift-selecting
    var selected = new Assoc();

    this.unmappedVisible = true; // Are unmapped signals visible?

    this.on_resize = function() {
        tableHeight = $('#'+this.id).height();
        frame = fullOffset(this.table);
        frame.cx = frame.left + frame.width * 0.5;
        frame.cy = frame.top + frame.height * 0.5;
    };

    this.direction = null;
    this.orientation = orientation;
    this.id = id;
    this.detail = null;
    this.parent;        // The node containing the table
    this.div;           // The div node (and status)
    this.table;         // The table node itself
    this.tbody;         // The <tbody> node
    this.title = 'Signals';

    this.nRows;         // Number of rows (e.g. devices or signals) present
    this.nVisibleRows;  // Number of rows actually visible to the user
    this.nCols;         // Number of columns in table
    this.scrolled = 0;
    this.zoomed = 1;

    this.border = false;
    var row_height = 0;
    this.regexp = null;

    function makeTable(self) {
        $(self.div).empty();

        // Create the skeleton for the table within the div
        // TODO: move div properties to css
        if (self.detail) {
            $(self.div).append(
                "<div style='height: 20px; position:relative; width:100%'>"+
                    "<div style='float: left; position:relative; width:75%; padding-left:10px'>device/signal name</div>"+
                    "<div style='float: left; position:relative; width:25%; padding-left:20px'>datatype</div>"+
                "</div>"+
                "<div id="+self.id+"Scroller style='top:20px; height:calc(100% - 20px); width:100%; position:absolute; overflow:auto'>"+
                    "<table class='displayTable'>"+
                        "<colgroup>"+
                            "<col style='width:75%'>"+
                            "<col style='width:25%'>"+
                        "</colgroup>"+
                        "<tbody></tbody>"+
                    "</table>"+
                "</div>");
        }
        else if (self.id == 'topTable') {
            $(self.div).append(
                "<div style='height: 200px; position:relative; width:20px'>"+
                    "<div style='float: left; position:relative; width:200px; padding-left:45px; transform-origin: 0% 0%; transform: translate(0%, 200px) rotate(270deg);'>device/signal name</div>"+
                "</div>"+
                "<div id="+self.id+"Scroller style='left:20px; top:0px; height:100%; width:calc(100% - 20px); position:absolute; overflow:auto'>"+
                    "<table class='displayTable'>"+
                        "<tbody></tbody>"+
                    "</table>"+
                "</div>");
        }
        else {
            $(self.div).append(
                "<div style='height: 20px; position:relative; width:100%'>"+
                    "<div style='float: left; position:relative; width:100%; padding-left:35px'>device/signal name</div>"+
                "</div>"+
                "<div id="+self.id+"Scroller style='top:20px; height:calc(100% - 20px); width:100%; position:absolute; overflow:auto'>"+
                    "<table class='displayTable'>"+
                        "<tbody></tbody>"+
                    "</table>"+
                "</div>");
        }
        self.table = $("#"+self.id+" .displayTable")[0];
        self.tbody = $("#"+self.id+" .displayTable tbody")[0];

        frame = fullOffset(self.table);
        frame.cx = frame.left + frame.width * 0.5;
        frame.cy = frame.top + frame.height * 0.5;
    }

    // Should be passed a the node for the parent
    this.create_within = function(parent) {
        this.parent = parent;

        // Create the div containing the table
        $(this.parent).append("<div class='tableDiv' id='"+id+"'></div>");
        this.div = $(this.parent).children("#"+this.id);
        tableHeight = $('.tableDiv').height();

        makeTable(this);
        this.add_handlers(this);
    };

//    this.set_title = function(title) {
////        console.log('set_title', title, this.title);
//        this.title = title;
//        $('#'+this.id+' h2').text(title);
//    }

    this.filter = function(dir, string) {
        if (dir)
            this.direction = dir;
        if (string) {
            this.filterstring = string;
            this.regexp = new RegExp(this.filterstring, 'i');
        }
//        if (dir == null)
//            this.set_title('Signals');
//        else if (dir == 'input')
//            this.set_title('Destinations');
//        else
//            this.set_title('Sources');
    }

    this.show_detail = function(show) {
        if (this.detail == show)
            return;
        this.detail = (show == true);
        makeTable(this);
        this.add_handlers(this);
    }

    this.border_mode = function(enabled) {
        this.border = (enabled == true);

        $(this.table).css({'width': this.border ? '200px' : '100%'});
//        $(this.table 'td').css({'width': this.border ? '50px' : '75px'});
    }

    this.height = function() {
        return row_height * this.table.rows.length;
    }

    this.row_from_name = function(name) {
        let id = name.replace('/', '\\/');
        for (var i = 0, row; row = this.table.rows[i]; i++) {
            if (row.id == id) {
                if (this.orientation == 'top') {
                    let left = i * row_height - this.scrolled;
                    let top = row.offsetLeft;
                    return { 'left': left,
                             'top': top,
                             'width': row_height,
                             'height': row.offsetWidth,
                             'cx': left + row_height * 0.5,
                             'cy': top + row.offsetWidth * 0.5,
                             'id': row.id.replace('\\/', '\/'),
                             'even': $(row).hasClass('even'),
                             'isOutput': $(row).hasClass('output')};
                }
                else {
                    let left = row.offsetLeft;
                    let top = i * row_height - this.scrolled + 20;
                    return { 'left': left,
                             'top': top,
                             'width': row.offsetWidth,
                             'height': row_height,
                             'cx': left + row.offsetWidth * 0.5,
                             'cy': top + row_height * 0.5,
                             'id': row.id.replace('\\/', '\/'),
                             'even': $(row).hasClass('even'),
                             'isOutput': $(row).hasClass('output') };
                }
            }
        }
        return null;
    }

    this.row_from_position = function(x, y) {
        if (x == null || y == null)
            return;
        if (this.orientation == 'top') {
            y = frame.top + 50;
        }
        else {
            x = this.div[0].offsetLeft + 50;
        }
        let td = document.elementFromPoint(x, y);
        let row = $(td).parents('tr');

        row = row[0];
        if (this.orientation == 'top') {
            let left = row.offsetTop - this.scrolled;
            let top = row.offsetLeft;
            return { 'left': left,
                     'top': top,
                     'width': row_height,
                     'height': row.offsetWidth,
                     'cx': left + row.offsetHeight * 0.5,
                     'cy': top + row.offsetWidth * 0.5,
                     'id': row.id.replace('\\/', '\/') };
        }
        else {
            let left = row.offsetLeft;
            let top = row.offsetTop - this.scrolled + 20;
            return { 'left': left,
                     'top': top,
                     'width': row.offsetWidth,
                     'height': row_height,
                     'cx': left + row.offsetWidth * 0.5,
                     'cy': top + row.offsetHeight * 0.5,
                     'id': row.id.replace('\\/', '\/') };
        }
    }

    this.highlight_row = function(row, clear) {
        if (clear)
            $('#'+this.id+' tr').removeClass('trsel');
        if (row && row.id) {
            let dom_row = document.getElementById(row.id.replace('\/', '\\/'));
            if (dom_row)
                $(dom_row).addClass('trsel');
        }
    }

    this.pan = function(delta) {
        let new_scroll = this.scrolled + delta;
        if (this.id == 'topTable') {
            this.scrolled = $("#"+this.id+"Scroller")
                                .scrollLeft(new_scroll)
                                .scrollLeft();
        }
        else {
            this.scrolled = $("#"+this.id+"Scroller")
                                .scrollTop(new_scroll)
                                .scrollTop();
        }
        if (this.scrolled == Math.floor(new_scroll)) {
            // keep fractional part
            this.scrolled = new_scroll;
        }
    }

    this.zoom = function(offset, delta) {
        offset -= 20;   // column headers

        delta *= -0.01;
        let new_zoom = this.zoomed + delta;
        if (new_zoom < 0.1 || new_zoom > 20) {
            return false;
        }

        let row_diff = Math.round(row_height * (1 + delta/this.zoomed)) - Math.round(row_height);
        if (row_diff == 0) {
            // no difference in row height from this zoom event
            this.zoomed = new_zoom;
            return false;
        }

        // offset in rows
        let norm_offset = (Math.floor(this.scrolled) + offset) / Math.round(row_height);

        this.pan(row_diff * norm_offset);
        this.zoomed = new_zoom;
    }

    this.update = function(targetHeight) {
        targetHeight -= 20;

        // http://stackoverflow.com/questions/661562/how-to-format-a-float-in-javascript
        function toFixed_alt(value, precision) {
            var power = Math.pow(10, precision || 0);
            return String(Math.round(value * power) / power);
        }

        $(this.tbody).empty();
        let tbody = this.tbody;
        let num_devs = 0;
        let num_sigs = 0;
        let dir = this.direction;
        let id = this.id;
        let detail = this.detail;
        let regexp = this.regexp;

        model.devices.each(function(dev) {
            let num_dev_sigs = 0;
            let sigs = [];
            dev.signals.each(function(sig) {
                // todo: check for filters
                if (dir && sig.direction != dir)
                    return;
                if (regexp && !regexp.test(sig.key))
                    return;

                let name = sig.name.replace(/\,/g, '<wbr>/');
                let min = sig.min;
                if (typeof(min) == 'object') {
                    for (i in min)
                        min[i] = toFixed_alt(min[i], 4);
                }
                else if (typeof(min) == 'number')
                    min = toFixed_alt(min, 4);
                min = String(min).replace(/\,/g, '<wbr>, ');
                if (min.indexOf(',') >= 0)
                    min = '[ ' + min + ' ]';

                let max = sig.max;
                if (typeof(max) == 'object') {
                    for (i in max)
                        max[i] = toFixed_alt(max[i], 4);
                }
                else if (typeof(max) == 'number')
                    max = toFixed_alt(max, 4);
                max = String(max).replace(/\,/g, '<wbr>, ');
                if (max.indexOf(',') >= 0)
                    max = '[ ' + max + ' ]';
                let type;
                switch (sig.type) {
                    case 'i':
                        type = 'int';
                        break;
                    case 'f':
                        type = 'float';
                        break;
                    case 'd':
                        type = 'double';
                        break;
                    default:
                        type = '?';
                        break;
                }
                let typelen = sig.length == 1 ? type : type + '[' + sig.length + ']';
                let unit = sig.unit == 'unknown' ? '' : ' ('+sig.unit+')';
                let ioname = (sig.direction == 'input') ? '→'+name : name+'→';

                sigs.push([sig.key.replace('/', '\\/'), ioname, typelen+unit, sig.direction]);
                num_dev_sigs += 1;
            });
            if (num_dev_sigs <= 0)
                return;

            $(tbody).append("<tr id="+dev.name+"><th colspan='2'>"+dev.name+"</th></tr>");
            let even = false;
            for (var i in sigs) {
                let new_row = "<tr class='"+sigs[i][3];
                if (even)
                    new_row += " even";
                new_row += "' id="+sigs[i][0]+"><td>"+sigs[i][1]+"</td>";
                if (detail)
                    new_row += "<td>"+sigs[i][2]+"</td>";
                new_row += "</tr>";
                $(tbody).append(new_row);
                even = !even;
            }
            num_devs += 1;
            num_sigs += num_dev_sigs;
        });
        // adjust row heights to fill table
        row_height = targetHeight / (num_devs + num_sigs);
        if (row_height > 18) {
            // don't allow zoom < 1
            if (this.zoomed < 1)
                this.zoomed = 1;
        }
        row_height *= this.zoomed;
        if (row_height < 18) {
            this.zoomed *= 18 / row_height;
            row_height = 18;
        }
        $("#"+this.id+' tbody tr').css('height', row_height+'px');
    }

    function select_tr(tr) {
        if (!tr)
            return;

        var t = $(tr);
        var name = tr.firstChild.innerHTML.replace(/<wbr>/g,'');

        if (t.hasClass("trsel")) {
            t.removeClass("trsel");
            selected.remove(name);
        } else {
            t.addClass("trsel");
            selected.add(name);
        }
        $('#container').trigger("updateMapProperties");
    }

    this.add_handlers = function(self) {
        $('#'+this.id+' tr').hover(function() {
            $(this).toggleClass('hover');
        });
//        $('.displayTable tbody').on({
//            mousedown: function(e) {
//                if (e.shiftKey == false)
//                    deselect_all();
//                select_tr(this);
//            },
//            click: function(e) { e.stopPropagation(); }
//        }, 'tr');


//        $('#'+this.id).on('mousedown', 'tr', function(tableClick) {
//            var sourceRow = this;
//            $(document).one('mouseup.drawing', function(mouseUpEvent) {
//                $("*").off('.drawing').removeClass('incompatible');
//                $(document).off('.drawing');
//            });
//        });
    }
}
