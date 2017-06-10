// An object for the overall display
function mapperTable(model, id, orientation, detail)
{
    var tableHeight = 0;
    var frame = null;

    // The most recently selected rows, for shift-selecting
    var selected = new Assoc();

    this.unmappedVisible = true; // Are unmapped signals visible?

    this.on_resize = function() {
        tableHeight = $('.tableDiv').height();
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

    this.border = false;

    function makeTable(self) {
        console.log('maketable');
        $(self.div).empty();

//        if (id != 'topTable') {
//            $(self.div).append("<div id='titleSearchDiv'>"+
//                               "<h2 id='"+id+"Title' class='searchBar'>"+self.title+"</h2>"+
//                               "<input type='text' id='"+id+"Search' class='searchBar'></input>"+
//                               "</div>");
//        }

        // Create the skeleton for the table within the div
        if (self.detail) {
            $(self.div).append(
                "<table class='displayTable'>"+
                    "<colgroup>"+
                        "<col style='width:75%'>"+
                        "<col style='width:25%'>"+
                    "</colgroup>"+
                    "<tbody></tbody>"+
                "</table>");
        }
        else {
            $(self.div).append(
                "<table class='displayTable'>"+
                    "<tbody></tbody>"+
                "</table>");
        }
        self.table = $(self.div).children('.displayTable')[0];
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
        this.add_handlers();
    };

//    this.set_title = function(title) {
////        console.log('set_title', title, this.title);
//        this.title = title;
//        $('#'+this.id+' h2').text(title);
//    }

    this.filter = function(dir, string) {
        this.direction = dir;
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
    }

    this.border_mode = function(enabled) {
        this.border = (enabled == true);

        $(this.table).css({'width': this.border ? '200px' : '100%'});
//        $(this.table 'td').css({'width': this.border ? '50px' : '75px'});
    }

    this.rowPos = function(name) {
        let scrollLeft = ($('#'+this.id)[0]).scrollLeft;
        let scrollTop = ($('#'+this.id)[0]).scrollTop;
        for (var i = 0, row; row = this.table.rows[i]; i++) {
            if (row.id == name) {
                if (this.orientation == 'left') {
                    return { 'left': row.offsetLeft,
                             'top': row.offsetTop - scrollTop,
                             'width': row.offsetWidth,
                             'height': row.offsetHeight,
                             'cx': row.offsetLeft + row.offsetWidth * 0.5,
                             'cy': row.offsetTop - scrollTop + row.offsetHeight * 0.5,
                             'even': $(row).hasClass('even') };
                }
                else if (this.orientation == 'right') {
                    return { 'left': row.offsetLeft,
                             'top': row.offsetTop - scrollTop,
                             'width': row.offsetWidth,
                             'height': row.offsetHeight,
                             'cx': row.offsetLeft + row.offsetWidth * 0.5,
                             'cy': row.offsetTop - scrollTop + row.offsetHeight * 0.5,
                             'even': $(row).hasClass('even') };
                }
                else {
                    return { 'left': row.offsetTop - scrollLeft,
                             'top': row.offsetLeft,
                             'width': row.offsetHeight,
                             'height': row.offsetWidth,
                             'cx': row.offsetTop - scrollLeft + row.offsetHeight * 0.5,
                             'cy': row.offsetLeft + row.offsetWidth * 0.5,
                             'even': $(row).hasClass('even') };
                }
            }
        }
        return null;
    }

    this.highlight = function(x, y) {
        $('#'+this.id+' tr').removeClass('trsel');
        if (x == null || y == null)
            return;
        if (this.orientation == 'top') {
//            if (x < frame.left || x > frame.left + frame.width)
//                return;
            y = frame.top + 50;
        }
        else {
//            if (y < frame.top || y > frame.top + frame.height)
//                return;
            x = frame.left + 50;
        }
        let td = document.elementFromPoint(x, y);
        let row = $(td).parents('tr');
        $(row).addClass('trsel');

        let scrollLeft = ($('#'+this.id)[0]).scrollLeft;
        let scrollTop = ($('#'+this.id)[0]).scrollTop;
        row = row[0];
        if (this.orientation == 'left' || this.orientation == 'right') {
            return { 'left': row.offsetLeft,
                     'top': row.offsetTop - scrollTop,
                     'width': row.offsetWidth,
                     'height': row.offsetHeight,
                     'id': row.id,
                     'cx': row.offsetLeft + row.offsetWidth * 0.5,
                     'cy': row.offsetTop - scrollTop + row.offsetHeight * 0.5 };
        }
        else {
            return { 'left': row.offsetTop - scrollLeft,
                     'top': row.offsetLeft,
                     'width': row.offsetHeight,
                     'height': row.offsetWidth,
                     'id': row.id,
                     'cx': row.offsetTop - scrollLeft + row.offsetHeight * 0.5,
                     'cy': row.offsetLeft + row.offsetWidth * 0.5 };
        }
    }

    this.update = function(targetHeight) {

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

        model.devices.each(function(dev) {
            let num_dev_sigs = 0;
            let sigs = [];
            dev.signals.each(function(sig) {
                // todo: check for filters
                if (dir && sig.direction != dir)
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
                let unit = sig.unit == 'unknown' ? '' : sig.unit;
                let ioname = (sig.direction == 'input') ? '→'+name : name+'→';

                sigs.push([sig.key, ioname, typelen+unit]);
                num_dev_sigs += 1;
            });
            if (num_dev_sigs <= 0)
                return;

            $(tbody).append("<tr id="+dev.name+"><th colspan='2'>"+dev.name+"</th></tr>");
            let even = false;
            for (var i in sigs) {
                let new_row = '<tr' + (even ? ' class=even' : '');
                new_row += ' id='+sigs[i][0]+'>';
                new_row += '<td>'+sigs[i][1]+'</td>';
                if (detail)
                    new_row += '<td>'+sigs[i][2]+'</td>';
                new_row += '</tr>';
                $(tbody).append(new_row);
                even = !even;
            }
            num_devs += 1;
            num_sigs += num_dev_sigs;
        });
        // adjust row heights to fill table
        let height = Math.floor((targetHeight-41)/(num_devs+num_sigs));
        $("#"+this.id+' tbody tr').css('height', height+'px');
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

    this.add_handlers = function() {
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

        $('#'+this.id).on('scroll', function(e) {
            $('#container').trigger('scroll');
        });

//        $('#'+this.id).on('mousedown', 'tr', function(tableClick) {
//            var sourceRow = this;
//            $(document).one('mouseup.drawing', function(mouseUpEvent) {
//                $("*").off('.drawing').removeClass('incompatible');
//                $(document).off('.drawing');
//            });
//        });
    }
}
