function LibMapperModel ()
{
	this.devices = new Assoc();
	this.signals = new Assoc();
	this.links = new Assoc();
	this.connections = new Assoc();
};

LibMapperModel.prototype = {
		
		isConnected : function (src, dst)
		{
			var conn = this.getConnection(src, dst);
			if(conn)
				return true;
			return false;
		},
		getConnection : function (src, dst)
		{
			var key = src + ">" + dst;
			return this.connections.get(key);
		}
};