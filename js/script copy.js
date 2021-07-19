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

  return Math.floor(Math.random()*16777215).toString(16);
}

const transparentize = (color, opacity) => {
  const _opacity = Math.round(Math.min(Math.max(opacity || 1, 0), 1) * 255);
  return color + _opacity.toString(16).toUpperCase();
}

class Actor {
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

class Speech {
  constructor(speechTag, timelineManager) {
    this.id = speechTag.getAttribute('ID');
    this.actors = []
    this.location = timelineManager.locationFromId(speechTag.getAttribute('LOCATION'))
    this.name = speechTag.getAttribute('NAME');
    this.persons = []
    this.text = speechTag.getAttribute('TEXT');
    
    var actorIds = speechTag.getAttribute('ACTORS').split(',')
    for (var actorId of actorIds) {
      var actor = timelineManager.actorFromId(actorId)
      if (actor != null) {
        this.actors.push(actor)
      }
    }

    var personIds = speechTag.getAttribute('PER').split(',');
    for (var personId of personIds) {
      this.persons.push(timelineManager.actorFromId(personId));
    }
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
}

class TimelinePoint {
  constructor(x, y, speech) {
    this.x = x
    this.y = y
    this.speech = speech
    this.isVisible = false
  }

  toString() {
    return `pos: ${this.x},${this.y} speeches: ${this.speech.id}`
  }
}

class TimelineManager {
  constructor(url) {
    this.url = url
    this.timelines = []
    this.xmlDoc = null
    this.actors = []
    this.locations = []
    this.speeches = []
    this.relations = []

    // UI stuff
    this.points = []
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
      if (point.speech.id == speech.id) return point
    }

    return null
  }

  processTimeline(actorId) {
    var orphans = 0
    
    for (var relation of this.relations) {
      if (this.points.find(p => { if (p.speech.id == relation.from.id) return p })) {
        continue  // We already have this point on the timeline
      }
      if (this.points.length == 0) {
        // Create the first point
        var point = new TimelinePoint(0, 0, relation.to)
        point.isVisible = relation.hasActor(actorId)
        this.points.push(point)
      }

      var toPoint = this.pointFromSpeech(relation.to)
      if (toPoint !== null) {
        var currentX = toPoint.x
        var currentY = toPoint.y
        if (relation.type == 'IMMEDIATELY_BEFORE') {
          currentX -= 1
        } else if (relation.type == 'IMMEDIATELY_AFTER') {
          currentX += 1
        } else if (relation.type == 'BEFORE') {
          currentX -= 2
        } else if (relation.type == 'AFTER') {
          currentX += 2
        } else if (relation.type == 'SIMULTANEOUS') {
          if (relation.hasActor(actorId)) currentY += 1
        }

        var point = new TimelinePoint(currentX, currentY, relation.from)
        point.isVisible = relation.hasActor(actorId)
        this.points.push(point)
      } else {
        orphans++
      }
    }

    return orphans
  }

  drawTimeline(actorId) {
    var retries = 0
    var orphansCount = this.processTimeline(actorId)
    while (orphansCount && ++retries < 20) {
      orphansCount = this.processTimeline(actorId)
    }

    if (orphansCount > 0) {
      console.error(`ERROR: ${orphansCount} speeches couldn't be placed on the timeline (no parents found)`)
    }

    // Sort the points
    this.points = this.points.sort((first, second) => { return first.x - second.x})
    // Filter the points
    this.points = this.points.filter(p => { return p.isVisible })

    // Adjusting the point offset so they start from 0
    // Get the minimum and maximum point
    var min = 0
    var max = 0
    for (var point of this.points) {
      min = Math.min(min, point.x)
    }
    // Increase the positions for each point
    for (var point of this.points) {
      point.x += Math.abs(min)
      max = Math.max(max, point.x)
    }
    // Break points in different timelines and create datasets
    var datasets = []
    for (var point of this.points) {
      // Create a new dataset if we don't have one for this timeline
      if (datasets[point.y] === undefined) {
        const color = getColor(point.y)
        var dataArray = new Array(max);
        dataArray.fill(null);
        datasets[point.y] = {
          label: null,
          borderColor: color,
          backgroundColor: transparentize(color, 0.5),
          borderWidth: 6,
          data: dataArray,
          points: [],
          spanGaps: true
        }
      }

      // if (point.speech.name == "Adam a rămas singur") {
      //   console.log(point.timeline, point.position)
      // }
      // if (point.timeline == 0 && point.position == 2) {
      //   console.log(point.speech.name)
      // }
      // if (point.speech.name == "Semne prevestitoare ale unei nenoriciri") {
      //   console.log(point.timeline, point.position)
      // }

      if (datasets[point.y] !== undefined && datasets[point.y].points[point.x] !== undefined) {
        console.log(point.x, point.y, datasets[point.y].points[point.x].speech.name, "--", point.speech.name)
      }

      datasets[point.y].points[point.x] = point
      datasets[point.y].data[point.x] = point.y
    }

    console.log(datasets)

    var labels = Array.from({length:35},(v,k)=>k+1);
    var data = {
      labels: labels,
      datasets: datasets
    }

    var ctx = document.getElementById('timeline');
    var timeline = new Chart(ctx, {
      type: 'line',
      data: data,
      options: {
        responsive: true,
        maintainAspectRatio: true,
        aspectRatio: 4,
        scales: {
          xAxis: {
            display: true,
            max: max
          },
          yAxis: {
            //display: false,
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
                return point.speech.name
              },
              label: (item) => {
                const point = item.dataset.points[item.dataIndex];
                const splited = point.speech.text.match(/\b[\w']+(?:[^\w\n]+[\w']+){0,25}\b/g);
                return splited
              },
              // footer: (item) => {
              //   const point = item[0].dataset.points[item[0].dataIndex];
              //   return `Trigger: ${point}`
              // }
            }
          }
        }
      },
    });

    // var currentDiv = document.createElement('div')
    // currentDiv.setAttribute('pointPos', 0)
    // currentDiv.setAttribute('class', 'group')
    // currentDiv.style.left = "0"

    // for (var i = 0; i < this.points.length; i++) {
    //   var point = this.points[i]
    //   var divPos = currentDiv.getAttribute('pointPos')
    //   if (divPos == point.position) {
    //     $(currentDiv).append(`<div class="circle" id="circle${i}"><div class="popupSpan">${point.speech.name}</div></div>`)
    //   } else {
    //     // Start a new div
    //     var prevPoint = this.points[i-1]
    //     $("#line").append(currentDiv)

    //     currentDiv = document.createElement('div')
    //     currentDiv.setAttribute('pointPos', point.position)
    //     currentDiv.setAttribute('class', 'group')
    //     currentDiv.style.paddingLeft = point.position - prevPoint.position > 1 ? '100px': '20px';

    //     $(currentDiv).append(`<div class="circle" id="circle${i}"><div class="popupSpan">${point.speech.name}</div></div>`)
    //   }
    // }

    // $("#line").append(currentDiv)

    // $(".circle").mouseenter(function() {
    //   $(this).addClass("hover")
    //   $('#mainCont').text($(this).first().text())
    // });
    
    // $(".circle").mouseleave(function() {
    //   $(this).removeClass("hover")
    //   $('#mainCont').text("")
    // });
    //$("#line").width(50 * this.points.length)
  }
}

var timelineManager = new TimelineManager('hln.xml')
timelineManager.load(function onComplete() {
  timelineManager.drawTimeline("A1")
});