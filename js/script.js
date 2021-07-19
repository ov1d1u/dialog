const getColor = (index) => {
  const colors = [
    "#f94144",
    "#f3722c",
    "#f8961e",
    "#f9c74f",
    "#f9844a",
    "#90be6d",
    "#43aa8b",
    "#4d908e",
    "#577590",
    "#277da1"
  ]

  if (index < colors.length) {
    return colors[index]
  }

  return "#" + Math.floor(Math.random()*16777215).toString(16);
}

const transparentize = (color, opacity) => {
  const _opacity = Math.round(Math.min(Math.max(opacity || 1, 0), 1) * 255);
  return color + _opacity.toString(16).toUpperCase();
}

String.prototype.splitByWordCount = function(count) {
  var arr = this.split(' ')
  var r = [];
  while (arr.length) {
    r.push(arr.splice(0, count).join(' '))
  }
  return r;
}

Array.prototype.insert = function ( index, item ) {
  this.splice( index, 0, item );
};

class Actor { // ... 
  constructor(actorTag, timelineManager) {
    this.id = actorTag.getAttribute('ID');
    this.name = actorTag.getAttribute('NAME');
  }
}

class Location {
  constructor(locationTag, timelineManager) {
    this.id = locationTag.getAttribute('ID');
    this.name = locationTag.getAttribute('NAME');
    this.parent = timelineManager.locationFromId(locationTag.getAttribute('PARENTID'));
  }
}

class Speech { // TS 
  constructor(speechTag, timelineManager) {
    this.id = speechTag.getAttribute('ID');
    this.actors = []
    this.location = timelineManager.locationFromId(speechTag.getAttribute('LOCATION'))
    this.name = speechTag.getAttribute('NAME');
    this.persons = []
    this.text = speechTag.getAttribute('TEXT');
    
    var actorIds = speechTag.getAttribute('ACTORS').split(',')
    for (var actorId of actorIds) {
      var actor = timelineManager.actorFromId(actorId) || timelineManager.actorFromName(actorId)
      if (actor != null) {
        this.actors.push(actor)
      }
    }

    var personIds = speechTag.getAttribute('PER').split(',');
    for (var personId of personIds) {
      this.persons.push(timelineManager.actorFromId(personId));
    }
  }

  hasActor(actorId) {
    for (var actor of this.actors) {
      if (actor.id == actorId) {
        return true
      }
    }
    return false
  }

  hasAnyOfActors(actorIds) {
    for (var actor of this.actors) {
      if (actorIds.includes(actor.id)) {
        return true
      }
    }
    return false
  }

  hasActors(actorIds) {
    return actorIds.every((actorId) => {
      const actors = this.actors.map((actor) => { return actor.id })
      return actors.indexOf(actorId) !== -1;
    });
  }
}

class Relation {
  constructor(relationTag, timelineManager) {
    this.id = relationTag.getAttribute('ID');
    this.from = timelineManager.speechFromId(relationTag.getAttribute('FROM'));
    this.to = timelineManager.speechFromId(relationTag.getAttribute('TO'));
    this.type = relationTag.getAttribute('REL');
    this.trigger = relationTag.getAttribute('TRIGGER');
  }
}

class Timeline {
  constructor(point) {
    this.points = []
    if (point) {
      this.addPoint(0, point)
    }
  }

  addPoint(index, point) {
    var i = Math.max(0, index)
    if (this.points[i] === undefined) {
      this.points[i] = point
    } else {
      this.points.insert(i, point)
    }
  }

  pointAt(index) {
    return this.points[index]
  }
}

class TimelinePoint {
  constructor(speech) {
    this.speech = speech
  }
}

class TimelineSpacer {
  constructor() {}
}

class TimelineManager {
  constructor(url) {
    this.url = url
    this.timelines = []
    this.orphanTimelines = []
    this.xmlDoc = null
    this.actors = []
    this.locations = []
    this.speeches = []
    this.relations = []

    this.orphans = []
  }

  load(cb) {
    var req = new XMLHttpRequest();
    req.onload = () => {
      var parser = new DOMParser();
      this.xmlDoc = parser.parseFromString(req.response, "text/xml");

      // load actors
      var actorTags = this.xmlDoc.getElementsByTagName('TA');
      for (var actorTag of actorTags) {
        this.actors.push(new Actor(actorTag, this));
      }

      // load locations
      var locationTags = this.xmlDoc.getElementsByTagName('TL');
      for (var locationTag of locationTags) {
        this.locations.push(new Location(locationTag, this));
      }

      // load speeches
      var speechTags = this.xmlDoc.getElementsByTagName('TS');
      for (var speechTag of speechTags) {
        this.speeches.push(new Speech(speechTag, this));
      }

      // load relations
      var relationTags = this.xmlDoc.getElementsByTagName('TREL');
      for (var relationTag of relationTags) {
        this.relations.push(new Relation(relationTag, this));
      }

      cb();
    }

    req.open("GET", this.url);
    req.send();
  }

  getActors() {
    var actorsMap = {}
    for (var actor of this.actors) {
      actorsMap[actor.id] = actor.name
    }

    return actorsMap
  }

  getOrphans() {
    return this.orphans.map((o) => { return o.id })
  }

  locationFromId(locationId) {
    var locationTags = this.xmlDoc.getElementsByTagName('TL');
    for (var locationTag of locationTags) {
      if (locationTag.getAttribute('ID') == locationId) {
        return new Location(locationTag, this);
      }
    }

    return null
  }

  actorFromId(actorId) {
    var actorTags = this.xmlDoc.getElementsByTagName('TA');
    for (var actorTag of actorTags) {
      if (actorTag.getAttribute('ID') == actorId) {
        return new Actor(actorTag, this);
      }
    }
    
    return null
  }

  actorFromName(actorName) {
    var actorTags = this.xmlDoc.getElementsByTagName('TA');
    for (var actorTag of actorTags) {
      if (actorTag.getAttribute('NAME') == actorName) {
        return new Actor(actorTag, this);
      }
    }
    
    return null
  }

  speechFromId(speechId) {
    var speechTags = this.xmlDoc.getElementsByTagName('TS');
    for (var speechTag of speechTags) {
      if (speechTag.getAttribute('ID') == speechId) {
        return new Speech(speechTag, this);
      }
    }
  }

  pointFromSpeech(speech) {
    for (var timeline of this.timelines) {
      for (var point of timeline.points) {
        if (point === undefined) {
          continue
        }
        if (point.speech.id === speech.id) {
          return point
        }
      }
    }

    return null
  }

  timelineOfPoint(p) {
    for (var timeline of [...this.timelines, ...this.orphanTimelines]) {
      for (var point of timeline.points) {
        if (point === undefined) {
          continue
        }
        if (p.speech.id === point.speech.id) {
          return timeline
        }
      }
    }
  }

  indexOfPoint(p) {
    var timelines = [...this.timelines, ...this.orphanTimelines]
    for (var i = 0; i < timelines.length; i++) {
      var timeline = timelines[i]
      for (var j = 0; j < timeline.points.length; j++) {
        var point = timeline.points[j]
        if (point === undefined) {
          continue
        }
        if (p.speech.id === point.speech.id) {
          return j
        }
      }
    }
  }

  processTimeline() {
    var orphans = []
    
    for (var relation of this.relations) {
      if (this.pointFromSpeech(relation.from)) {
        continue  // We already have this point on the timeline
      }
      if (this.timelines.length == 0) {
        // Create the first point
        var point = new TimelinePoint(relation.to)
        var timeline = new Timeline(point)
        this.timelines.push(timeline)
      }

      var point = new TimelinePoint(relation.from)
      var toPoint = this.pointFromSpeech(relation.to)
      
      if (toPoint === null) {
        this.timelines.push(new Timeline(), new Timeline())  // padding
        toPoint = new TimelinePoint(relation.to)
        var timeline = new Timeline(toPoint)
        this.orphanTimelines.push(timeline)
      }

      var x = this.indexOfPoint(toPoint)
      var newX = undefined
      var timeline = this.timelineOfPoint(toPoint)

      if (relation.type == 'IMMEDIATELY_BEFORE') {
        newX = x-1
      } else if (relation.type == 'IMMEDIATELY_AFTER') {
        newX = x+1
      } else if (relation.type == 'BEFORE') {
        newX = x-2
      } else if (relation.type == 'AFTER') {
        newX = x+2
      } else if (relation.type == 'SIMULTANEOUS') {
        var timeline = new Timeline()
        timeline.addPoint(x, point)
        this.timelines.push(timeline)
      }

      if (newX !== undefined) {
        if (timeline.pointAt(newX) !== undefined) {
          timeline = new Timeline()
          this.timelines.push(timeline)
        }
        timeline.addPoint(newX, point)
      }
    }

    return orphans
  }

  drawTimeline(actorIds) {
    var retries = 0
    var maxX = 0
    this.orphans = this.processTimeline()
    while (this.orphans.length && ++retries <= 10) {
      this.orphans = this.processTimeline()
    }

    if (this.orphans.length > 0) {
      console.error(`ERROR: ${this.orphans.length} speeches couldn't be placed on the timeline (no parents found)`)
    }

    // Break points in different timelines and create datasets
    var datasets = []
    var timelines = this.timelines.filter((tl) => { return tl.points.filter((pt) => { return pt.speech.hasAnyOfActors(actorIds) == true }).length > 0 })
    if (this.orphanTimelines.length > 0) {
      timelines.push(new Timeline(), new Timeline(), new Timeline(), new Timeline(), new Timeline(), new Timeline())
      timelines.push(...this.orphanTimelines)
    }

    for (var i = 0; i < timelines.length; i++) {
      var timeline = timelines[i]
      const color = this.orphanTimelines.includes(timeline) ? "#000000" : getColor(i)
      var dataset = {
        label: null,
        borderColor: color,
        backgroundColor: transparentize(color, 0.5),
        borderWidth: 6,
        data: [],
        points: [],
        spanGaps: true
      }
      for (var j = 0; j < timeline.points.length; j++) {
        var point = timeline.points[j]
        if (point !== undefined && point.speech.hasActors(actorIds)) {
          dataset.points[j] = point
          dataset.data[j] = i
          maxX = Math.max(maxX, j)
        }
      }
      
      if (dataset.data.length > 0) {
        datasets.push(dataset)
      }
    }

    var labels = Array.from({length:maxX + 2},(v,k)=>k+1);
    var data = {
      labels: labels,
      datasets: datasets
    }

    if (window.timelineChart) {
      window.timelineChart.destroy();
    }

    var ctx = document.getElementById('timeline');
    window.timelineChart = new Chart(ctx, {
      type: 'line',
      data: data,
      options: {
        responsive: true,
        maintainAspectRatio: true,
        aspectRatio: 4,
        scales: {
          xAxis: {
            display: true,
            max: maxX + 2
          },
          yAxis: {
            display: false,
            reverse: true
          }
        },
        plugins: {
          title: {
            display: false
          },
          legend: {
            display: false
          },
          tooltip: {
            enabled: true,
            displayColors: false,
            callbacks: {
              title: (item) => {
                const point = item[0].dataset.points[item[0].dataIndex];
                return `${point.speech.id}: ${point.speech.name}`
              },
              label: (item) => {
                const point = item.dataset.points[item.dataIndex];
                const splited = point.speech.text.splitByWordCount(25);
                return [`Actor(s):`, point.speech.actors.map((actor) => { return actor.name }), '', `Content:`, ...splited]
              }
              // footer: (item) => {
              //   const point = item[0].dataset.points[item[0].dataIndex];
              //   return `Trigger: ${point}`
              // }
            }
          }
        }
      },
    });
  }
}
