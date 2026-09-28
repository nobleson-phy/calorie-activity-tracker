// Activity MET values. kind "distance" supports minutes/km/steps entry;
// "generic" supports minutes only.
const ACTIVITIES = [
  { id:"walk",     name:"Walking (4.8 km/h)",      met:3.5,  kind:"distance", speed:4.8 },
  { id:"briskwalk",name:"Brisk walking (6.4 km/h)",met:5.0,  kind:"distance", speed:6.4 },
  { id:"jog",      name:"Jogging (8 km/h)",        met:8.3,  kind:"distance", speed:8.0 },
  { id:"run",      name:"Running (10.8 km/h)",     met:11.0, kind:"distance", speed:10.8 },
  { id:"cycle",    name:"Cycling (moderate)",      met:6.8,  kind:"generic" },
  { id:"swim",     name:"Swimming",                met:7.0,  kind:"generic" },
  { id:"yoga",     name:"Yoga",                     met:2.5,  kind:"generic" },
  { id:"badminton",name:"Badminton",                met:5.5,  kind:"generic" },
  { id:"cricket",  name:"Cricket",                  met:4.8,  kind:"generic" },
  { id:"gym",      name:"Gym / weights",            met:5.0,  kind:"generic" },
  { id:"chores",   name:"Household chores",         met:3.3,  kind:"generic" },
  { id:"stairs",   name:"Climbing stairs",          met:8.0,  kind:"generic" },
  { id:"dance",    name:"Dancing",                  met:5.0,  kind:"generic" },
];

// Speed lookup by id, used for "activity needed today" alternatives.
const DISTANCE_ACTIVITY_IDS = ["walk", "briskwalk", "jog", "run"];
