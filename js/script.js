const getColor = (index) => {
  const colors = [
    "#ffffff",
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
    this.isMain = actorTag.getAttribute('TYPE') === "MAIN";
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
}

class Relation {
  constructor(relationTag, timelineManager) {
    this.id = relationTag.getAttribute('ID');
    this.from = timelineManager.speechFromId(relationTag.getAttribute('FROM'));
    this.to = timelineManager.speechFromId(relationTag.getAttribute('TO'));
    this.type = relationTag.getAttribute('REL');
    this.trigger = relationTag.getAttribute('TRIGGER');
  }

  hasActor(actorId) {
    for (var actor of [...this.to.actors, ...this.from.actors]) {
      if (actor.id == actorId)
        return true
    }
    
    return false
  }

  hasAnyOfActors(actorIds) {
    for (var actor of [...this.to.actors, ...this.from.actors]) {
      if (actorIds.includes(actor.id)) {
        return true
      }
    }
    return false
  }
}

class TimelinePoint {
  constructor(speech) {
    this.speech = speech
  }
}

class TimelineGap extends TimelinePoint {}

class TimelineManager {
  constructor(options = {}) {
    var defaults = {
      showLabels: false
    }
    this.options = Object.assign({}, defaults, options);
    
    this.xmlDoc = null
    this.actors = []
    this.locations = []
    this.speeches = []
    this.relations = []

    this.points = []
    this.orphans = []
  }

  load(url, cb) {
    var req = new XMLHttpRequest();
    req.onload = () => {
      this.loadString(req.response);
      cb();
    }

    req.open("GET", url);
    req.send();
  }

  loadString(string) {
    var parser = new DOMParser();
    this.xmlDoc = parser.parseFromString(string, "text/xml");

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
  }

  getActors() {
    var actorsMap = {}
    for (var actor of this.actors) {
      actorsMap[actor.id] = actor.name
    }

    return actorsMap
  }

  getMainActors() {
    var actorsMap = {}
    for (var actor of this.actors) {
      if (actor.isMain)
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
    for (var point of this.points) {
      if (point instanceof TimelineGap) {
        continue
      }
      if (point.speech.id === speech.id) {
        return point
      }
    }

    return null
  }

  indexOfPoint(p) {
    for (var j = 0; j < this.points.length; j++) {
      var point = this.points[j]
      if (point instanceof TimelineGap) {
        continue
      }
      if (p.speech.id === point.speech.id) {
        return j
      }
    }
  }

  processTimeline(actorIds) {
    this.orphans = []
    
    for (var relation of this.relations) {
      if (this.pointFromSpeech(relation.from)) {
        continue  // We already have this point on the timeline
      }
      if (this.points.length == 0) {
        // Create the first point
        const point = new TimelinePoint(relation.to)
        this.points.push(point)
      }

      const point = new TimelinePoint(relation.from)
      const toPoint = this.pointFromSpeech(relation.to)

      if (toPoint) {
        const idx = this.indexOfPoint(toPoint)

        if (relation.type == 'IMMEDIATELY_BEFORE') {
          this.points.insert(idx, point)
        } else if (relation.type == 'IMMEDIATELY_AFTER' || relation.type == 'SIMULTANEOUS') {
          this.points.insert(idx + 1, point)
        } else if (relation.type == 'BEFORE') {
          this.points.insert(idx, point)
          this.points.insert(idx+1, new TimelineGap(relation.from))
        } else if (relation.type == 'AFTER') { // new empy node with FROM reference
          this.points.insert(idx+1, new TimelineGap(relation.from))
          this.points.insert(idx+2, point)
        }
      } else {
        this.orphans.push(relation.from) 
      }
    }
  }

  drawTimeline(actorIds, stepsLimit = -1) {
    var retries = 0
    var maxX = 0
    this.processTimeline(actorIds)
    while (this.orphans.length && ++retries <= 10) {
      this.processTimeline(actorIds)
    }

    if (this.orphans.length > 0) {
      console.error(`ERROR: ${this.orphans.length} speeches couldn't be placed on the timeline (no parents found)`)
    }

    const color = getColor(0)
    var dataset = {
      label: null,
      borderColor: color,
      backgroundColor: transparentize(color, 0.5),
      borderWidth: 6,
      data: [],
      points: [],
      spanGaps: true,
      datalabels: {
        color: '#FFFFFF',
        align: 'top',
        offset: 12
      }
    }

    var currentPos = 0
    for (var point of this.points) {
      if (point.speech.hasAnyOfActors(actorIds)) {
        if (!(point instanceof TimelineGap)) {
          dataset.points[currentPos] = point
          dataset.data[currentPos] = 0
          maxX = Math.max(maxX, currentPos)
        }
        currentPos++

        if (stepsLimit > -1 && currentPos === stepsLimit) {
          break
        }
      }
    }

    var labels = Array.from({length:maxX + 2},(v,k)=>k+1);
    var data = {
      labels: labels,
      datasets: [dataset]
    }

    if (window.timelineChart) {
      window.timelineChart.destroy();
    }

    var ctx = document.getElementById('timeline');
    window.timelineChart = new Chart(ctx, {
      plugins: [ChartDataLabels],
      type: 'line',
      data: data,
      options: {
        responsive: true,
        maintainAspectRatio: true,
        aspectRatio: 4,
        scales: {
          xAxis: {
            display: false,
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
          },
          datalabels: {
            formatter: (value, context) => {
              const point = context.dataset.points[context.dataIndex];
              return this.options.showLabels ? point.speech.id : null
            }
          }
        }
      },
    });
  }
}
