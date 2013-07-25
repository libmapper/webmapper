"use strict";

/* Make an asynchronous HTTP request to the browser. */
function http_request(path, args, ok_responder, error_responder) {
  var client = new XMLHttpRequest();
  client.onreadystatechange = function() {
    if(this.readyState == 4)
      ok_responder(this.responseText);
    else if (error_responder)
      error_responder(this.responseText);
  }
  var a='';
  var n=0;
  for (var i in args) {
    if (n==0)
      a+='?';
    else
      a+='&';
    a += encodeURIComponent(i) + '=' + encodeURIComponent(args[i]);
    n++;
  }
  client.open("GET", path+a);
  client.send("");
}

/* A simple object class to represent a bucket of things that can be
 * put in or taken out. */
function Bucket() {
    this.contents = [];
    this.put = function(a) {
        this.contents.push(a);
    }
    this.take = function(a) {
        for (i in this.contents) {
            if (this.contents[i]==a) {
                this.contents.splice(i,1);
                return;
            }
        }
    }
}

/* Helper function to trace debug output. */
function trace(text) {
    var out = document.getElementById('output');
    if (out)
        out.innerHTML += '<p>'+text+'</p>\n'
}

/* Class to wrap an association list. */
function Assoc() {
    this.contents = {};
    this.add = function(key, value) {
        this.contents[key] = value;
    },
    this.remove = function(name) {
        delete this.contents[name];
    },
    this.get = function(name) {
        return this.contents[name];
    },
    this.keys = function() {
        var keys = [];
        for (var k in this.contents)
            keys.push(k);
        return keys;
    }
    this.length = function() {
        return keys.length;
    }

}

/* Split a full signal name into device and signal parts. */
function splitSigName(signame)
{
    var i = signame.indexOf("/", 1);
    if (i<0)
        return null;

    return [signame.substring(0, i),
            signame.substring(i)];
}

/* Get the full offset and size of an element. */
function fullOffset(e)
{
    var o = {left:0,top:0,width:0,height:0};
    if (e.offsetParent)
        o = fullOffset(e.offsetParent);
    return {left:e.offsetLeft - e.scrollLeft + o.left,
            top:e.offsetTop - e.scrollTop + o.top,
            width:e.offsetWidth,
            height:e.offsetHeight};
}

/* add an item to an array only if it is unique */
function arrPushIfUnique(item, arr){
	if(arrIsUnique(item, arr))
		arr.push(item);
}

/* check if an item is unique in an array */
function arrIsUnique(item, arr){
	for(var i=0; i<arr.length; i++){
		if(arr[i] == item)
			return false;
	}	
	return true;
}
