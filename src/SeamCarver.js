var Picture = require('./Picture.js');
var Timer   = require('./Timer.js');

function SeamCarver(pic) {
    this.picture = pic;
    this.energy = this.buildEnergy();
}

SeamCarver.prototype = {
    constructor: SeamCarver,

    width: function() {
        return this.picture.width();
    },

    height: function() {
        return this.picture.height();
    },

    energyAt: function(x, y) {
        return this.energy[y * this.width() + x];
    },

    buildEnergy: function() {
        var W = this.width();
        var H = this.height();
        var energy = new Array(W * H);
        var index = 0;
        for (var y = 0; y < H; y++) {
            for (var x = 0; x < W; x++) {
                energy[index++] = this.calculateEnergyAt(x, y);
            }
        }
        return energy;
    },

    // to find energy of a pixel, find the sum of the square of the differences between red, green, and blue components of neighbor pixels
    // calculate the difference left to right and then above to below
    calculateEnergyAt: function(x, y) {
        // border pixels receive max energy 255^2 + 255^2 + 255^2 = 195075.
        if (x == 0 || y == 0 || x == this.width() - 1 || y == this.height() - 1)
            return 195075;
        var left  = this.picture.at(x - 1, y);
        var right = this.picture.at(x + 1, y);
        var above = this.picture.at(x, y - 1);
        var below = this.picture.at(x, y + 1);
        var xGradient = (left.red   - right.red)    * (left.red   - right.red) + 
                        (left.green - right.green)  * (left.green - right.green) + 
                        (left.blue  - right.blue)   * (left.blue  - right.blue);
        var yGradient = (above.red   - below.red)   * (above.red   - below.red) +
                        (above.green - below.green) * (above.green - below.green) +
                        (above.blue  - below.blue)  * (above.blue  - below.blue);
        return xGradient + yGradient;
    },

    removeVerticalSeam: function() {
        console.log("\n");
        var timer = new Timer("1.         findVerticalSeam");
        var verticalSeam = this.findVerticalSeam();
        timer.logElapsedTime();
        
        timer = new Timer("3.              carveColumn");
        this.carveColumn(verticalSeam);
        timer.logElapsedTime();

        timer = new Timer("2. updateVerticalSeamEnergy");
        this.updateVerticalSeamEnergy(verticalSeam);   // must call this BEFORE removing seam or width will be one too short
        timer.logElapsedTime();

        /*
        timer = new Timer("4.              buildEnergy");
        this.energy = this.buildEnergy();
        timer.logElapsedTime();
        */
        console.log("\n");
    },

    updateVerticalSeamEnergy: function(seam) {
        var W = this.width() + 1;         // picture has already been carved and this needs the old width
        var H = this.height();
        var energy = this.energy;
        var newEnergy = new Array((W - 1) * H);
        var index = 0;
        for (var y = 0; y < H; y++) {
            for (var x = 0; x < W; x++) {
                if (seam[y] != x) {
                    newEnergy[index++] = energy[y * W + x];
                }
            }
        }
        energy = newEnergy;
        W--;                              // width is now correct
        for (var y = 1; y < H - 1; y++) { // skip first and last rows because they will not change
            if (seam[y] - 1 >= 0) {       // if in bounds, update energy on the left side of the seam
                energy[y * W + seam[y] - 1] = this.calculateEnergyAt(seam[y] - 1, y);
            }
            if (seam[y] < W) {            // if in bounds, update energy on the right side of the seam
                energy[y * W + seam[y]] = this.calculateEnergyAt(seam[y], y);
            }
        }
        this.energy = energy;
    },

    findVerticalSeam: function() {
        var distTo = [];       // value represents the total energy needed to get to this pixel
        var edgeTo = [];       // value represents previous x index on shortest path to this value.
        var W = this.width();
        var H = this.height();

        // initialize first row of distTo to 0
        distTo[0] = [];
        edgeTo[0] = [];
        for (var x = 0; x < W; x++) {
            distTo[0][x] = 0;
            edgeTo[0][x] = null;
        }

        // initialize all other rows to infinity
        for (var y = 1; y < H; y++) {
            distTo[y] = [];
            edgeTo[y] = [];
            for (var x = 0; x < W; x++) {
                distTo[y][x] = Infinity; 
                edgeTo[y][x] = null;
            }
        }

        // find shortest paths from top to bottom
        for (var y = 0; y < H - 1; y++) {
            for (var x = 0; x < W; x++) {
                // relax children
                for (var i = -1; i <= 1; i++) {  // look at three pixels below this pixel
                    if (x + i < 0 || x + i >= W) // if index would be out of bounds, continue
                        continue;
                    if (distTo[y + 1][x + i] > distTo[y][x] + this.energyAt(x, y)) {  // if true, a lower energy path has been found
                        edgeTo[y + 1][x + i] = x;
                        distTo[y + 1][x + i] = distTo[y][x] + this.energyAt(x, y);
                    }
                }
            }
        }

        // find the shortest path
        var endPoint = 0;
        for (var i = 1; i < W; i++) {
            if (distTo[H - 1][i] < distTo[H - 1][endPoint])
                endPoint = i;
        }
        var verticalSeam = [endPoint];
        for (var h = H - 2; h >= 0; h--) {
            verticalSeam.unshift(edgeTo[h + 1][verticalSeam[0]]);  // find previous pixel in edgeTo
        }
        return verticalSeam;
    },

    toCanvas: function() {
        return this.picture.toCanvas();
    },

    // returns a new picture object with the given vertical seam removed
    carveColumn: function(seam) {
        if (seam.length != this.height())
            throw new Error("Invalid vertical seam length. Picture height = " + this.height() + " and Seam.length = " + seam.length);
        var W = this.width();
        var H = this.height();
        var data = this.picture.data();
        var newData = new Uint8ClampedArray((W - 1) * H * 4);

        // copy data (minus seam) to newData
        var newIndex = 0;
        for (var y = 0; y < H; y++) {
            for (var x = 0; x < W; x++) {
                if (seam[y] != x) {
                    var oldIndex = y * W * 4 + x * 4
                    newData[newIndex++] = data[oldIndex++];    // Red
                    newData[newIndex++] = data[oldIndex++];    // Green
                    newData[newIndex++] = data[oldIndex++];    // Blue
                    newData[newIndex++] = data[oldIndex];      // alpha
                }
            }
        }
        this.picture = new Picture(newData, W - 1, H);        
    }

}

module.exports = SeamCarver;