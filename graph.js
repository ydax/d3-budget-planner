/////////////////////////////////////////////////////
//////// Dynamic d3 graph displayed to user /////////
/////////////////////////////////////////////////////

// set up the dimensions of the chart
const dims = {
    height: 300,
    width: 300,
    radius: 150
}

// determine the center of my chart
const cent = {
    x: (dims.width / 2 + 5),
    // chart cntr -^     ^-- 5px to right
    y: (dims.height / 2 + 5)
}

// create the SVG container for the graph
const svg = d3.select('.canvas')
    .append('svg')
    .attr('width', dims.width + 150)
    // add space for legend -----^
    .attr('height', dims.height + 150)

// create a group w/ graph elements and append
const graph = svg.append('g')
    // append group ----^     ^-- g for group
    // transform group to translate it to center
    .attr('transform', `translate(${cent.x}, ${cent.y})`);

/////////////////////////////////////////////////////
////////// generate our pie graph angles ////////////
/* this is a function that will receive data (often,
    in the form of an array), not sort it, and then
    evaluate each data element to determine the
    correct angle for my pie chart */
/////////////////////////////////////////////////////
const pie = d3.pie()
    // tell d3 don't sort angles based on size
    .sort(null)
    // make angles based on cost property
    .value(d => d.cost);
    //     ^--- d for data object

/////////////////////////////////////////////////////
////////// generate our pie graph slices ////////////
/////////////////////////////////////////////////////

const arcPath = d3.arc()
    // how far out the slices go on the canvas
    .outerRadius(dims.radius)
    // used to create a donut chart
    .innerRadius(dims.radius / 2);

// take a domain and convert it into a color range for use in coloring wedges
const color = d3.scaleOrdinal(d3['schemeSet1']);

/////////////////////////////////////////////////////
//////// listen to the Firestore database ///////////
/////////////////////////////////////////////////////
var data = [];

// set up the legend
const legendGroup = svg.append('g')
    .attr('transform', `translate(${dims.width + 40}, 10)`)
const legend = d3.legendColor()
    // set the shape that will be to the left of each legend item
    .shape('circle')
    .shapePadding(10)
    .scale(color);

// creates a tip w/ the Tooltop d3 script
const tip = d3.tip()
    //              ^-- makes the tip library chainable on d3, and adds a tip 
    .attr('class', 'tip card')
    //                 ^-- adds materialize styling
    .html(d => {
        let content = `<div class="name">${d.data.name}</div>`;
        content += `<div class="cost">$${d.data.cost}</div>`;
        content += `<div class="delete">Click slice to delete</div>`
        return content;
    });
    // ^-- what's inside the tooltip when shown (takes @d)

graph.call(tip);

// function that fires when Firestore sends us a new data snapshot
const update = (data) => {

    // update the color scale domain by creating a new array (using the map method) comprised of the name propoerty in each object
    color.domain(data.map(d => d.name));

    // update and call the legend
    legendGroup.call(legend);
    legendGroup.selectAll('text').attr('fill', 'white')

    // pass the Firestore data into the pie() and join to path elements
    const paths = graph.selectAll('path')
        // Select the group's paths, use the data() method to join our @data param array after passing it through pie(). This creates virtual elements ready to be entered (enter selection) to the DOM.
        .data(pie(data));
    
    // append a path to each virtual enter selection by appending characteristics to the d attribute by referencing the arcPath method
    paths.enter()
        .append('path')
        .attr('class', 'arc')
        // automatically pass data object into the arcPath method (commented out b/c using a transition + tween to build it now)
        // .attr('d', arcPath)
        .attr('stroke', '#fff')
        .attr('stroke-width', 3)
        // because we pass our data to pie(), the name property is inside the data property returned by pie()
        .attr('fill', d => color(d.data.name))
        .each(function(d) { this._current = d })
        // call the tween to animate arcs
        .transition().duration(750)
            .attrTween('d', arcTweenEnter);
    
        // attach listeners to graph elements -- callbacks handled at higher scope
    graph.selectAll('path')
        .on('mouseover', (d, i, n) => {
            tip.show(d, n[i]);
        //    ^-- method from tip library
            handleMouseOver(d, i, n);
        })
// listen event -^  callback ---^
        .on('mouseout', (d, i, n) => {
            // hide the tooltip when we move out of the slice
            tip.hide();
            handleMouseOut(d, i, n);
        })
        .on('click', handleClick)


    //get any in the exit selection and remove
    paths.exit()
        .transition().duration(750)
            .attrTween('d', arcTweenExit)
        .remove();

    // handle current DOM path updates
        // grab the current selection "paths" and its "d" attribute (this draws the SVG), and call the arcPath function to reset it
    paths.attr('d', arcPath)
        .transition().duration(750)
        .attrTween('d', arcTweenUpdate);

}

// onSnapshot() listens to the collection and does something with each response
db.collection('expenses').onSnapshot(res => {

    res.docChanges().forEach(change => {
        // iterate over the change data and create a new object called doc for each one that also includes the id property generated by Firebase
        const doc = { ...change.doc.data(), id: change.doc.id };

        // detect what kind of change has happened to the Firestore and trigger actions accordingly
        switch (change.type) { 
            // if something was added to the collection, add it to the data array
            case 'added':
                data.push(doc);
                break;
            // if modified, find the index of the doc in the data array and replace it with the new version
            case 'modified':
                const index = data.findIndex(item => item.id == doc.id);
                data[index] = doc;
                break;
            // if something was removed, replace the data array with a new one after filtering out the removed one using its unique id
            case 'removed':
                data = data.filter(item => item.id !== doc.id);
                break;
            default:
                break;
        }

    })

    // call update() when data received
    update(data);

})

// tween to interpolate angles, use them to re-draw (animate) path for *enter* selection
const arcTweenEnter = (d) => {
    var i = d3.interpolate(d.endAngle, d.startAngle);

    return function (t) {
        d.startAngle = i(t);
        return arcPath(d);
    }
};

// tween to interpolate angles, use them to re-draw (animate) path for *exit* selection
const arcTweenExit = (d) => {
    var i = d3.interpolate(d.startAngle, d.endAngle);

    return function (t) {
        d.startAngle = i(t);
        return arcPath(d);
    }
};

/* tween to interpolate angles for wedges being modified but not in the enter or exit selection */
// use function keyword instead of arrow function so we can use this keyword to reference current element
function arcTweenUpdate(d) {
    // interpolate between the two objects
    var i = d3.interpolate(this._current, d);
    // update the _current prop with the new data
    this._current = i(1);

    return function (t) {
        return arcPath(i(t));
    }
};

// event handlers
const handleMouseOver = (d, i, n) => {
    // data + index + array
    
    //console.log(n[i]);
    //        ^--- returns this element

    d3.select(n[i])
        .transition('changeSliceFill').duration(300)
            .attr('fill', '#fff');
}

const handleMouseOut = (d, i, n) => {
    d3.select(n[i])
        .transition('changeSliceFill').duration(300)
            .attr('fill', color(d.data.name));
}

const handleClick = (d) => {
    const id = d.data.id;
    db.collection('expenses').doc(id).delete();
}
