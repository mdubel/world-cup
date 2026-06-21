# Shared confederation lookup + constants for the analysis/ scripts.

CONFEDS <- c("UEFA", "CONMEBOL", "CAF", "AFC", "CONCACAF", "OFC")
POWERS     <- c("UEFA", "CONMEBOL")                 # the "old powers"
CHALLENGERS <- c("CONCACAF", "CAF", "AFC", "OFC")   # the "newbies"

# Host country per tournament (shown under the year on chart x-axes).
HOSTS <- c(
  "1998" = "France",        "2002" = "Korea/Japan", "2006" = "Germany",
  "2010" = "South Africa",  "2014" = "Brazil",      "2018" = "Russia",
  "2022" = "Qatar",         "2026" = "USA/Can/Mex"
)

`%||%` <- function(a, b) if (is.null(a)) b else a

# Australia is special-cased by year: OFC in 2006 (it took Oceania's berth),
# AFC from 2010 on. 2026 carries its own confederation column in the TSV, but
# match data still resolves through here, so the map must cover every team.
CONFED_MAP <- local({
  m <- c()
  add <- function(conf, teams) { for (t in teams) m[[t]] <<- conf }
  add("CONMEBOL", c("Brazil","Argentina","Uruguay","Paraguay","Colombia","Ecuador","Chile","Peru"))
  add("CONCACAF", c("Mexico","United States","Costa Rica","Honduras","Trinidad and Tobago",
                    "Panama","Canada","Jamaica","Haiti","Curacao"))
  add("CAF",      c("Morocco","Nigeria","South Africa","Cameroon","Tunisia","Senegal","Ghana",
                    "Ivory Coast","Angola","Togo","Algeria","Egypt","Cape Verde"))
  add("AFC",      c("Saudi Arabia","South Korea","Japan","Iran","China","North Korea","Qatar"))
  add("OFC",      c("New Zealand"))
  add("UEFA",     c("France","Italy","Germany","Spain","England","Netherlands","Portugal","Belgium",
                    "Croatia","Sweden","Denmark","Norway","Scotland","Switzerland","Poland","Russia",
                    "Serbia","Serbia and Montenegro","FR Yugoslavia","Yugoslavia","Czech Republic",
                    "Ukraine","Greece","Bulgaria","Romania","Slovenia","Slovakia","Bosnia and Herzegovina",
                    "Iceland","Wales","Austria","Republic of Ireland","Turkey"))
  m
})

confed_of <- function(team, year) {
  if (identical(team, "Australia")) return(if (year == 2006) "OFC" else "AFC")
  c <- CONFED_MAP[[team]]
  if (is.null(c)) stop(sprintf("No confederation mapping for '%s' (%s). Add it to CONFED_MAP in analysis/confederations.R.", team, year))
  c
}
