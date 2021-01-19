class MapProperties {
    constructor(container, graph, view) {
        this.container = container;
        this.graph = graph;
        this.view = view;
        this.mapProtocols = ["UDP", "TCP"];

        $(this.container).append(
            "<div' class='topMenu' style='width:calc(100% - 324px);'>"+
                "<div id='curveButton' style='width:20px;height:100%'>"+
                    "<div>"+
                        "<div id='curveTitle' class='topMenuTitle half'><strong>CURVE</strong></div>"+
                    "</div>"+
                    "<div id='exprButton' style='width:20px;height:68px'>"+
                        "<div id='exprTitle' class='topMenuTitle half' style='top:53px'><strong>EXPR</strong></div>"+
                    "</div>"+
                "</div>"+
                "<div id='mapPropsDiv' style='position:absolute;left:0px;width:100%;height:100%;'></div>"+
            "</div>");

        $('#mapPropsDiv').append(
            "<div id='expression' class='topMenuContainer' style='background:black;padding:2px;overflow:scroll'>"+
                "<table id='exprTable'><tbody id='exprTableBody'></tbody></table>"+
            "</div>"+
                                 "<div id='curve'></div>");

        this.cachedProperty = { "key": null, "value": null };
        this._addHandlers();
    }

    _addHandlers() {
        var self = this;
        var counter = 0;

        $('#networkSelection').on('change', function(e) {
            command.send("select_network", e.currentTarget.value);
        });

        $('#curveButton').on('click', function(e) {
            console.log('curveButton clicked!');
        });

        $('#exprButton').on('click', function(e) {
            console.log('exprButton clicked!');
        });

        // The expression input handler
        $('#expression').on({
            keydown: function(e) {
                e.stopPropagation();
                let table = $(e.currentTarget);
                let title = $('#exprTitle');
                let td = $(e.target);
                let tr = td.parent('tr');
                let rowIndex = tr.index();
                let temp, sel = window.getSelection();
                switch (e.which) {
                    case 37: // left arrow
                        if (sel.anchorOffset > 0)
                            break;
                        if (e.target.cellIndex == 3) {
                            tr.children('td')[1].focus();
                        }
                        else if (e.target.cellIndex == 1 && rowIndex > 0) {
                            tr.prev().children('td')[3].focus();
                        }
                        break;
                    case 38: // up arrow
                        if (rowIndex > 0)
                            tr.prev().children('td')[e.target.cellIndex].focus();
                        // check if row is empty
                        else {
                            // prepend a row to table
                            tr.before("<tr><td class='index'>"+rowIndex+"</td><td class='lhs' contenteditable=true></td><td>=</td><td class='rhs' contenteditable=true></td><td><div class='clear'></div></td><td class='value'></td></tr>");
                            // move focus to new row
                            tr.prev().children('td')[1].focus();
                            // renumber remaining rows
                            let trs = table.children('tbody').children('tr');
                            for (let i = rowIndex; i < trs.length; i++) {
                                $(trs[i]).children('td')[0].textContent = i;
                                if (i%2==0) {
                                    $(trs[i]).removeClass('even');
                                    $(trs[i]).addClass('odd');
                                }
                                else {
                                    $(trs[i]).removeClass('odd');
                                    $(trs[i]).addClass('even');
                                }
                            }
                        }
                        break;
                    case 39: // right arrow
                        if (sel.anchorOffset >= td.text().length) {
                            if (e.target.cellIndex == 1)
                                tr.children('td')[3].focus();
                            else if (e.target.cellIndex == 3) {
                                temp = tr.next().children('td')[1];
                                if (!temp)
                                    break;
                                temp.focus();
                            }
                         }
                         break;
                    case 40: // down arrow
                         temp = tr.next().children('td')[e.target.cellIndex];
                         if (!temp)
                             break;
                         temp.focus();
                         break;
                    case 91:
                        break;
                    case 13: //'enter' key
                    {
                        e.preventDefault();
                        // send changes to graph
                        // first check if only literals were changed
                        let edited = $('#exprTable tbody').children('tr')
                                                          .filter('.edited');
                        let numbers = /^[-+]?[0-9]+\.[0-9]+$/;
                        let literals_only = true;
                        function asNumberOrArray(s) {
                            if (s[0] == '[') {
                                // treat as array
                                s = s.slice(1, s.length-1);
                                let a = s.split(',').map(Number);
                                if (a.some(v => v != v)) {
                                    console.log("value array", a, "contains NaN!");
                                    return null;
                                }
                                return a;
                            }
                            let v = Number(s);
                            if (v != v) {
                                console.log("value", v, "== NaN!");
                                return null;
                            }
                        }
                        for (let i=0; i < edited.length; i++) {
                            let rhs = $(edited[i]).children('td').eq(3).text();
                            console.log('testing subexpr rhs', rhs);
                            if (asNumberOrArray(rhs) == null) {
                                literals_only = false
                                break;
                            }
                        }
                        if (literals_only) {
                            for (let i=0; i < edited.length; i++) {
                                let key = $(edited[i]).children('td').eq(1).text();
                                let value = $(edited[i]).children('td').eq(3).text();
                                value = asNumberOrArray(value);
                                console.log('edited literal', key, value);
                                self.setMapProperty('var@'+key, value);
                            }
                        }
                        else {
                            // need to concatenate entire table and send
                            let all = $('#exprTable tbody').children('tr');
                            let str = "";
                            for (let i = 0; i < all.length; i++) {
                                let key = $(all[i]).children('td').eq(1).text();
                                let value = $(all[i]).children('td').eq(3).text();
                                if (key != "" && value != "")
                                    str += key+'='+value+';';
                            }
                            console.log('edited expr', str);
                            self.setMapProperty('expr', str);
                        }
                        break;
                    }
                    case 27: // 'escape' key
                    {
                        e.preventDefault();
                        break;
                    }
                    case 9:
                    {
                        // 'tab' key
                        e.preventDefault();
                        if (e.target.cellIndex == 3) {
                            // add another row to table
                            tr.after("<tr><td class='index'>"+(rowIndex+1)+"</td><td class='lhs' contenteditable=true></td><td>=</td><td class='rhs' contenteditable=true></td><td><div class='clear'></div></td><td class='value'></td></tr>");
                            // move focus to new row
                            tr.next().children('td')[1].focus();
                            // renumber remaining rows
                            let trs = table.children('tbody').children('tr');
                            for (let i = rowIndex+1; i < trs.length; i++) {
                                $(trs[i]).children('td')[0].textContent = i;
                                if (i%2==0) {
                                    $(trs[i]).removeClass('even');
                                    $(trs[i]).addClass('odd');
                                }
                                else {
                                    $(trs[i]).removeClass('odd');
                                    $(trs[i]).addClass('even');
                                }
                            }
                        }
                        else if (e.target.cellIndex == 1)
                            tr.children('td')[3].focus();
                        break;
                    }
                    case 187:
                    {
                         if (e.shiftKey == false) {
                             // '=' key
                             e.preventDefault();
                             if (e.target.cellIndex != 1)
                                 return;
                             tr.children('td')[3].focus();
                             break;
                         }
                    }
                    default:
                    {
//                        console.log('e.which:', e.which);
                        counter = 0;
                        // cell has been edited, make background red
                        tr.addClass('edited');
                        title.addClass('edited');
                    }
                }
            },
            keyup: function (e) {
                if (e.metaKey != true) {
                    $(e.currentTarget).css({background: 'black'});
                }
            },
            click: function(e) { e.stopPropagation();
                if (!$(e.target).hasClass('clear'))
                    return;
                let td = $(e.target).parent('td');
                let tr = td.parent('tr');
                let rowIndex = tr.index();
                let trs = $(e.currentTarget).children('tbody').children('tr');
                if (trs.length > 1) {
                    $(tr).remove();
                    // renumber remaining rows
                    for (let i = rowIndex; i < trs.length; i++) {
                        $(trs[i]).children('td')[0].textContent = i;
                        if (i%2==0) {
                            $(trs[i]).removeClass('even');
                            $(trs[i]).addClass('odd');
                        }
                        else {
                            $(trs[i]).removeClass('odd');
                            $(trs[i]).addClass('even');
                        }
                    }
                }
                else {
                    let sibs = td.siblings();
                    sibs.filter(':eq(1),:eq(3)').empty();
                    sibs[1].focus();
                }
                tr.addClass('edited');
                $('#exprTitle').addClass('edited');
            },
            focusout: function(e) {
//                console.log('table.focusout');
//                e.stopPropagation();
//                self.setMapProperty('expr', this.value);
            },
        }, 'table');

        $('.topMenu .protocol').on("click", function(e) {
            e.stopPropagation();
            self.setMapProperty("protocol", e.currentTarget.innerHTML);
        });

        $('body').on('keydown', function(e) {

            if (e.which == 67) { // 'C'
                let selected = self.graph.maps.filter(m => m.selected);
                if (selected && selected.size()) {
                    self.view.showCurveEditor(self.getCurveProperties(), function (expr, c) {
                        self.setMapProperty("expr", expr);
                        self.setMapProperty("curve", c);
                    });
                }
            }
            else if (e.which == 68) // 'D'
                self.setMapProperty("process_location", "destination");
            else if (e.which == 73) // 'I'
                self.setMapProperty("use_inst", null);
            else if (e.which == 77) // 'M'
                self.setMapProperty("muted", null);
            else if (e.which == 83) // 'S'
                self.setMapProperty("process_location", "source");
            else if (e.which == 84) // 'T'
                self.setMapProperty("protocol", "TCP");
            else if (e.which == 85) // 'U'
                self.setMapProperty("protocol", "UDP");
        });

        $('.expr_doc_link').click(function(e) {
            // show expression documentation
            $('#status').stop(true, false)
                        .empty()
                        .load('./doc/expression_syntax.html')
                        .css({'left': '20%',
                              'top': 70,
                              'width': '60%',
                              'height': 'calc(100% - 90px)',
                              'opacity': 0.9});
        });
    }

    // clears and disables the map properties bar
    clearMapProperties() {
        $('.protocol').removeClass('sel');
        $('.topMenu .range').val('');
        $('.topMenu textarea').val('');
        $('.signalControl').children('*').removeClass('disabled');
        $('.signalControl').addClass('disabled');
        $('#exprTitle').removeClass('edited').addClass('disabled');
        $('#curvetitle').removeClass('edited').addClass('disabled');
        $('.expression').removeClass('waiting');
        $('#exprTable').empty();
    }

    selected(map) {
        return map.selected;
    }

    updateMapProperties() {
        this.clearMapProperties();

        var proto = null;
        var expr = null;
        var vars = {};

        let selected = this.graph.maps.filter(m => m.selected);

        if (selected && selected.size()) {
            // something has been selected
            $('#exprTitle').removeClass('disabled');
            $('#curveTitle').removeClass('disabled');
            $('.signalControl').removeClass('disabled');
            $('.signalControl').children('*').removeClass('disabled');
        }
        else
            return;

        selected.forEach(function(map) {
            if (proto == null)
                proto = map.protocol;
            else if (proto != map.protocol)
                proto = 'multiple';
            if (expr == null)
                expr = map.expr;
            else if (expr != map.expr)
                expr = 'multiple expressions';

            for (let prop in map) {
                if (!map.hasOwnProperty(prop))
                    continue;
                if (!prop.startsWith("var@"))
                    continue;
                let key = prop.slice(4);
                if (vars[key] == undefined)
                      vars[key] = map[prop];
                else
                    vars[key] = 'multiple values';
            }
        });

        if (proto != null && proto != 'multiple') {
            $("#proto"+proto).addClass("sel");
        }

        let exprTable = $("#exprTable");
        exprTable.empty();
        if (expr == 'multiple expressions') {
            exprTable.css({'font-style': 'italic'});
            exprTable.append("<tr class='even'><td class='index'></td><td colspan=3 class='rhs' contenteditable=true>Multiple Expressions</td><td><div class='clear'></div></td><td class='value'></td></tr>")
        }
        else if (expr != null) {
            console.log("setting expr to", expr);
            console.log("vars=", vars);
            $(".expression").removeClass('waiting');
            exprTable.css({'font-style': 'normal'});

            function colorCode(e, v) {
                Raphael.getColor.reset();
                // color variable names
                for (let key in v) {
                    let re = new RegExp('(?<![#a-z0-9])'+key+'(?![#a-z0-9])', 'g');
                    let color = Raphael.getColor();
                    e = e.replace(re, "<span style='color:"+color+"'>"+key+"</span>");
                }
                return e;
            }
            expr = expr.split(';');
            let rowType = 'even';
            for (let i in expr) {
                if (!expr[i])
                    continue;
                // split and color-code by assignment
                let assignment = expr[i].indexOf('=');
                let left = expr[i].slice(0, assignment);
                let tdClass = vars[left] !== undefined ? 'literal' : '';
                let value = vars[left];
                if (value === undefined)
                    value = 'dynamic';
                else if (Array.isArray(value)) {
                    value = value.map(v => v.toFixed(3));
                }
                else
                    value = value.toFixed(3);
                left = colorCode(left, vars);
                let right = expr[i].slice(assignment+1);
                if (value != 'dynamic') {
                    let replaceVal = Number(right);
                    if (replaceVal == replaceVal)
                        right = value;
                    else
                        right = colorCode(right, vars);
                }
                else
                    right = colorCode(right, vars);
                exprTable.append("<tr class='"+rowType+"'><td class='index'>"+(parseInt(i)+1)+"</td><td class='lhs' contenteditable='true'>"+left+"</td><td>=</td><td class='rhs' contenteditable='true' class='"+tdClass+"'>"+right+"</td><td><div class='clear'></div></td><td class='value'>"+value+"</td></tr>");
                rowType = rowType == 'even' ? 'odd' : 'even';
            }
        }
    }

    getCurveProperties() {
        var curveProps = {
            src_min: null,
            src_max: null,
            dst_min: null,
            dst_max: null,
            curve: null,
        };

        this.graph.maps.filter(this.selected).forEach(function(map) {
            if (map.srcs.length == 1) {
                if (curveProps.src_min == null)
                    curveProps.src_min = map.srcs[0].min;
                if (curveProps.src_max == null)
                    curveProps.src_max = map.srcs[0].max;
            }
            if (curveProps.dst_min == null)
                curveProps.dst_min = map.dst.min;
            if (curveProps.dst_max == null)
                curveProps.dst_max = map.dst.max;
            if (map.curve != 'undefined')
                curveProps.curve = map.curve;
        });

        return curveProps;
    }

    // object with arguments for the map
    updateMapPropertiesFor(key) {
        // check if map is selected
        var map = this.graph.maps.find(key);
        if (this.selected(map))
            this.updateMapProperties();
    }

    cacheMapProperty(key, value) {
        this.cachedProperty = { "key": key, "value": value };
    }

    sendCachedProperty() {
        if (!this.cachedProperty || !this.cachedProperty.key || !this.cachedProperty.value)
            return;
        this.setMapProperty(this.cachedProperty.key, this.cachedProperty.value);
    }

    setMapProperty(key, value) {
        let container = $(this.container);
        this.graph.maps.filter(this.selected).forEach(function(map) {
            if (map[key] && (map[key] == value || map[key] == parseFloat(value)))
                return;

            var msg = {};

            // set the property being modified
            switch (key) {
            case 'muted':
                msg['muted'] = !map['muted'];
                break;
            case 'use_inst':
                msg['use_inst'] = !map['use_inst'];
                break;
            case 'expr':
//                value = value.replace(/\r?\n|\r/g, '');
                // for user friendliness we will automatically insert missing vector indices
                for (var i in map.srcs) {
                    console.log("mapping srclen "+map.srcs.length+" to dstlen "+map.dst.length);
                }
                if (value == map.expr)
                    return;
                msg['expr'] = value;
                $(".expression").addClass('waiting');
                break;
            default:
                msg[key] = value;
            }

            // copy src and dst names
            msg['srcs'] = map.srcs.map(s => s.key);
            msg['dst'] = map['dst'].key;

            // send the command, should receive a /mapped message after.
            console.log('sending set_map', msg);
            command.send("set_map", msg);
        });
        this.cachedProperty = { "key": null, "value": null };
    }

    on_load() {
        var self = this;

        //A quick fix for now to get #container out of the way of the load dialogs
        var body = document.getElementsByTagName('body')[0];
        var iframe = document.createElement('iframe');
        iframe.name = 'file_upload';
        iframe.style.visibility = 'hidden';
        body.appendChild(iframe);

        var form = document.createElement('form');
        form.innerHTML = '<input id="file" type="file"                   \
                           name="mapping_json" size="40" accept="json">  \
                          <input type="submit" style="display: none;">   \
                          <input type="button" value="Cancel" id="cancel">';
        form.method = 'POST';
        form.enctype = 'multipart/form-data';
        form.action = '/load';
        form.target = 'file_upload';

        var l = document.createElement('li');
        l.appendChild(form);
        $('.topMenu').append(l);

        iframe.onload = function() {
//            var t = $(iframe.contentDocument.body).text();
//            if (t.search('Success:') == -1 && t.search('Error:') == -1)
//                return;
            self.notify($(iframe.contentDocument.body).text());
            $(l).remove();
            body.removeChild(iframe);
        };

        $('#cancel', form).click(function() {
            $(l).remove();
            $('#container').removeClass('onLoad');
            body.removeChild(iframe);
        });

        form.firstChild.onchange = function() {

            var fn = document.createElement('input');
            fn.type = 'hidden';
            fn.name = 'filename';
            fn.value = form.firstChild.value;
            form.appendChild(fn);

            // The devices currently in focused
            var devs = self.view.get_focused_devices();

            // Split them into sources and destinations
            var srcdevs = [];
            var dstdevs = [];
            this.graph.devices.forEach(function(dev) {
                if (devs.includes(dev.name)) {
                    if (dev.num_sigs_out)
                        srcdevs.push(dev.name);
                    if (dev.num_sigs_in)
                        dstdevs.push(dev.name);
                }
            });

            // So that the monitor can see which devices are being looked at
            var srcs = document.createElement('input');
            srcs.type = 'hidden';
            srcs.name = 'sources';
            srcs.value = srcdevs.join();
            form.appendChild(srcs);

            var dsts = document.createElement('input');
            dsts.type = 'hidden';
            dsts.name = 'destinations';
            dsts.value = dstdevs.join();
            form.appendChild(dsts);

            form.submit();
        };
        return false;
    }

    notify(msg) {
        var li = document.createElement('li');
        li.className = 'notification';
        li.innerHTML = msg;
        $('.topMenu').append(li);
        setTimeout(function() {
            $(li).fadeOut('slow', function() { $(li).remove();});
        }, 5000);
    }

    /**
     * Updates the save/loading functions based on the view's state
     * currently set up for the list view only
     */
    updateSaveLocation(location) {
        // get the save location
        if (location) {
            window.saveLocation = location;
        }
        else {
            window.saveLocation = '';
        }

        // update the save button's link
        $('#saveButton').attr('href', window.saveLocation);

        // if saving is not ready, disable the save button
        if (window.saveLocation == '') {
            $('#saveButton, #loadButton').addClass('disabled');
        }
        // if saving is ready, enable the save button
        else {
            $('#saveButton, #loadButton').removeClass('disabled');
        }
    }
}
