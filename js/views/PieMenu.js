// A radial menu widget

// usage:
// set the slices of the pie to objects with the desired properties (once)
// call position(x, y) to set the origin of the Pie
// call show() to make the Pie visible
// call selection(x, y) to get the name of the item selected by the given coordinates
//      and update the appearance of the Pie to highlight the current selection
// call hide() when you're done to make the Pie invisible

// TODO: devise a way to ensure that the pie is drawn on top of HTML such as signal
// tables, e.g. give the menu its own SVG canvas element on top of everything else?

class Pie
{
    constructor(canvas, slices, x=0, y=0) 
    {
        this.canvas = canvas;
        this.inner_radius = 20;
        this.thickness = 90;
        this.spacing_angle = 4;
        this.glyph_margin = 2;
        this.position(x, y, false); 
        this.rotate(0, false);
        this.set_slices(slices);
        this.hide();
    }

    set_slice(i, s)
    {
        if (0 <= i && i < this._slices.length)
        {
            this._unpaint(i);
            if (!this.valid_slice(s)) 
            {
                this._slices.splice(i, 1);
                this._paint_all(); // portions will have changed by removing a slice
            }
            else 
            {
                this._slices[i] = s;
                this._paint(i);
            }
        }
        return;
    }

    set_slices(slices)
    {
        // TODO handle cases where there are very few slices
        this._slices = slices.map(s => this.valid_slice(s) ? s : null)
                             .filter(s => s !== null);
        this._paint_all();
    }

    // set the origin on the Pie
    position(x, y, redraw = true)
    {
        if (typeof x === 'number' && typeof y === 'number')
        {
            this.x = x; 
            this.y = y; 
            if (redraw) this._paint_all();
        }
    }

    // rotate the Pie clockwise by degrees
    rotate(degrees, redraw = true)
    {
        if (typeof degrees === 'number')
        {
            while (degrees < 0) degrees += 360;
            while (degrees > 360) degrees -= 360;
            this.rotation = degrees;
            if (redraw) this._paint_all();
        }
    }

    // highlight the current selection and return its name. return null if x y are in
    // the middle of the pie 
    selection(x, y, strong=false)
    {
        if (!(typeof x === 'number' && typeof y === 'number')) return null;

        let vec = {'x': x - this.x, 'y': y - this.y};
        let magn = norm(vec.x, vec.y);
        if (magn < this.inner_radius) 
        {
            this._paint_all(); // to ensure no hightlight
            return null;
        }

        let selected = this._slices[0];
        let angle = this._vec_to_angle(vec, magn);
        for (let i = 1; i < this._slices.length; ++i)
        {
            let slice = this._slices[i];
            let diff1 = Math.abs(angle - this._apply_rotation(selected.angle));
            let diff2 = Math.abs(angle - this._apply_rotation(slice.angle))
            diff1 = diff1 > 180 ? 360 - diff1 : diff1;
            diff2 = diff2 > 180 ? 360 - diff2 : diff2;
            if (diff2 < diff1) selected = slice;
        }
        if (selected.items)
        {
            let item = Math.floor((magn - this.inner_radius) / this.thickness);
            if (item >= selected.items.length) item = selected.items.length - 1;
            this.highlight(selected, item);
            return selected.items[item].name;
        }
        else return null;
    }

    show()
    {
        for (let s of this._slices) {
            s.arc.show();
            if (s.items) for (let i of s.items) i.icon.show();
        }
        this.hidden = false;
        this._paint_all();
    }

    hide() 
    { 
        for (let s of this._slices) {
            s.arc.hide();
            if (s.items) for (let i of s.items) i.icon.hide();
        }
        this.hidden = true;
    }

    highlight(slice, itemidx, strong = false)
    {
        this._paint_all();
        if (slice.color !== 'none') slice.arc.attr('stroke', strong ? 'red' : 'black');
        if (slice.items && slice.items[itemidx]) 
            slice.items[itemidx].icon.attr('src', slice.items[itemidx].highlight_img_uri);
    }

    // check if a slice has the minimum properties required to use it
    valid_slice(s)
    {
        if (typeof s === 'undefined' || s === null) return false;
        if (typeof s.angle !== 'number')
        {
            console.log('invalid Pie slice: expected numerical angle (in degrees)');
            return false;
        }
        if (typeof s.items !== 'undefined' && (!(s.items instanceof Array) || s.items.length == 0))
        {
            console.log('invalid Pie slice: optional items property must be a non-empty array');
            return false;
        }
        if (typeof s.color !== 'undefined' && typeof s.color !== 'string')
        {
            console.log('invalid Pie slice: optional color must be a string')
            return false;
        }
        if (s.items) for (let i of s.items) 
        {
            if (typeof i.name !== 'string') 
            {
                console.log('invalid Pie slice: all items must have a name')
                return false;
            }
            if (typeof i.default_img_uri !== 'string')
            {
                console.log('invalid Pie slice: all items must have a default image uri')
                return false;
            }
            if (typeof i.highlight_img_uri !== 'string')
            {
                console.log('invalid Pie slice: all items must have a highlight image uri')
                return false;
            }
        }
        return true;
    }

    // draw the slice at index i
    _paint(i)
    {
        let s = this._slices[i];
        if (!s.arc) s.arc = this.canvas.path(this._arc(i));
        else s.arc.attr({path: this._arc(i)});
        s.arc.attr({'fill': 'none',
                    'stroke': s.color ? s.color : Pie.fill_color,
                    'stroke-width': this.thickness});
        s.arc.toFront();
        
        if (this.hidden) s.arc.hide();

        if (s.items) for (let i in s.items)
        {
            let item = s.items[i];
            let size = this.thickness*0.75 - this.glyph_margin;
            let vec = {'x': 0, 'y': -(this.inner_radius + this.thickness / 2 + i * this.thickness)};
            vec = this._rotate(vec, degToRad(this._apply_rotation(s.angle)));
            vec.x += this.x - size/2;
            vec.y += this.y - size/2;
            if (!item.icon) item.icon = this.canvas.image(item.default_img_uri, 
                                                          vec.x, vec.y, size, size);
            else item.icon.attr({x: vec.x, y: vec.y, 
                            height: size, width: size, 
                            src:item.default_img_uri});
            if (this.hidden) item.icon.hide();
            else item.icon.toFront();
        }

    }

    // remove the svg representation of the slice at index i
    _unpaint(i)
    {
        let s = this._slice[i].arc.remove();
        for (let i of s.items) item.icon.remove();
    }

    _paint_all() { for (let i = 0; i < this._slices.length; ++i) this._paint(i); }
    _unpaint_all() { for (let i = 0; i < this._slices.length; ++i) this._unpaint(i); }

    // get the slices on either side of the slice at index i
    _neighbors(i)
    {
        let max = this._slices.length - 1;
        let prev = i == 0 ? max : i - 1;
        let next = i == max ? 0 : i + 1;
        return {p: this._slices[prev], n: this._slices[next]}
    }

    // get the coordinates of the start and end of the arc drawn for a slice at index i
    _arc(i)
    {
        let s = this._slices[i];
        let ns = this._neighbors(i);

        ns.p.angle = this._apply_rotation(ns.p.angle);
        ns.n.angle = this._apply_rotation(ns.n.angle);

        let sa = this._apply_rotation(s.angle);
        let pa = ns.p.angle < sa ? ns.p.angle : ns.p.angle - 360;
        let na = ns.n.angle > sa ? ns.n.angle : 360 + ns.n.angle;

        let angles = [(pa + sa) / 2, (sa + na) / 2];
        angles[0] += this.spacing_angle / 2;
        angles[1] -= this.spacing_angle / 2;
        angles = angles.map(a => degToRad(a));

        let radius = this.inner_radius + this.thickness / 2;
        let v = {x: 0, y: -radius}; // 12 o'clock vector
        let arc = {start: this._rotate(v, angles[0]), 
                   end:   this._rotate(v, angles[1])};
        arc.start.x += this.x;
        arc.start.y += this.y;
        arc.end.x   += this.x;
        arc.end.y   += this.y;

        let rotation = 0;
        let large_arc = 0;
        let sweep = 1;
        return [['M', arc.start.x, arc.start.y], 
                ['A', radius, radius, rotation, large_arc, sweep, 
                      arc.end.x, arc.end.y, ]
               ]
    }

    // rotate a vector in the window left handed coordinate space clockwise
    _rotate(v, rad)
    {
        return {x: v.x * Math.cos(rad) - v.y * Math.sin(rad),
                y: v.x * Math.sin(rad) + v.y * Math.cos(rad)};
    }

    _apply_rotation(degrees)
    {
        return (degrees + this.rotation) % 360;
    }

    // get the angle in degrees which rotates (0,-1) (i.e. 12 o'clock) clockwise to v
    _vec_to_angle(v, magn = null)
    {
        if (magn === null) magn = norm(v.x, v.y);
        let angle = radToDeg(Math.acos(-v.y / magn));
        if (v.x < 0) angle = 360 - angle;
        return angle;
    }
}

Pie.fill_color = 'white'

var ConvergentMappingSlices =
[
    {angle: 0,   color: 'white', 
        items: [{name: mapper.convergent.method.sum, 
            default_img_uri:mapper.convergent.icon.sum.black,
            highlight_img_uri:mapper.convergent.icon.sum.white}]},
    {angle: 90,  color: 'white', 
        items: [{name: mapper.convergent.method.average, 
            default_img_uri:mapper.convergent.icon.average.black, 
            highlight_img_uri:mapper.convergent.icon.average.white}]},
    {angle: 180, color: 'white', 
        items: [{name: mapper.convergent.method.default, 
            default_img_uri:mapper.convergent.icon.default.black, 
            highlight_img_uri:mapper.convergent.icon.default.white}]},
    {angle: 270, color: 'white', 
        items: [{name: mapper.convergent.method.product, 
            default_img_uri:mapper.convergent.icon.product.black, 
            highlight_img_uri:mapper.convergent.icon.product.white}]},
];

