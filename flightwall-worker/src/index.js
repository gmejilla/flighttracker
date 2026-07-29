export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const flight = url.searchParams.get("flight");

    if (!flight) {
      return Response.json({success:false,error:"Missing flight parameter"},{status:400});
    }

    const api =
      "https://airlabs.co/api/v9/flight?" +
      "api_key=" + env.AIRLABS_API_KEY +
      "&flight_icao=" + encodeURIComponent(flight);

    try {
      const resp = await fetch(api);
      const json = await resp.json();

      if (!json.response || json.response.length === 0) {
        return Response.json({success:false,route:null},{
          headers:{
            "Content-Type":"application/json",
            "Access-Control-Allow-Origin":"https://gmejilla.github.io"
          }
        });
      }

      const f = json.response[0];

      return Response.json({
        success:true,
        provider:"airlabs",
        callsign:f.flight_icao,
        hex:f.hex ?? null,
        registration:f.reg_number ?? null,
        airline:f.airline_name ?? null,
        aircraft:f.aircraft_icao ?? null,
        origin:{
          iata:f.dep_iata ?? "",
          icao:f.dep_icao ?? ""
        },
        destination:{
          iata:f.arr_iata ?? "",
          icao:f.arr_icao ?? ""
        },
        status:f.status ?? "",
        confidence:100
      },{
        headers:{
          "Content-Type":"application/json",
          "Access-Control-Allow-Origin":"https://gmejilla.github.io",
          "Access-Control-Allow-Methods":"GET"
        }
      });
    } catch(err) {
      return Response.json({success:false,error:String(err)},{status:500});
    }
  }
};
