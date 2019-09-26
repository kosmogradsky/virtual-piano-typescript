module Parser exposing (..)


type Parser raw result
    = Parser (raw -> Result String ( result, raw ))


pop : Int -> Parser (List a) (List a)
pop n =
    Parser (\s -> Ok ( List.take n s, List.drop n s ))


map : (a -> b) -> Parser raw a -> Parser raw b
map f (Parser parse) =
    Parser <|
        \raw ->
            case parse raw of
                Err msg ->
                    Err msg

                Ok ( result, remainedRaw ) ->
                    Ok ( f result, remainedRaw )


map2 : (a -> b -> c) -> Parser raw a -> Parser raw b -> Parser raw c
map2 f (Parser parseA) (Parser parseB) =
    Parser <|
        \rawA ->
            case parseA rawA of
                Err msg ->
                    Err msg

                Ok ( resultA, rawB ) ->
                    case parseB rawB of
                        Err msg ->
                            Err msg

                        Ok ( resultB, rawC ) ->
                            Ok ( f resultA resultB, rawC )


andMap : Parser s a -> Parser s (a -> b) -> Parser s b
andMap =
    \b a -> map2 (<|) a b


map3 : (a -> b -> c -> d) -> Parser raw a -> Parser raw b -> Parser raw c -> Parser raw d
map3 f a b c =
    map f a
        |> andMap b
        |> andMap c


andThen : (a -> Parser raw b) -> Parser raw a -> Parser raw b
andThen f (Parser parse) =
    Parser <|
        \raw ->
            case parse raw of
                Err msg ->
                    Err msg

                Ok ( result, remainedRaw ) ->
                    let
                        (Parser parseNext) =
                            f result
                    in
                    parseNext remainedRaw


type Step acc result
    = Loop acc
    | Done result


loop : acc -> (acc -> Parser raw (Step acc result)) -> Parser raw result
loop seed callback =
    Parser <|
        \raw ->
            loopHelp seed callback raw


loopHelp : acc -> (acc -> Parser raw (Step acc result)) -> raw -> Result String ( result, raw )
loopHelp acc callback raw =
    let
        (Parser parse) =
            callback acc
    in
    case parse raw of
        Err msg ->
            Err msg

        Ok ( loopResult, remainedRaw ) ->
            case loopResult of
                Loop nextAcc ->
                    loopHelp nextAcc callback remainedRaw

                Done finalResult ->
                    Ok ( finalResult, remainedRaw )


return : a -> Parser raw a
return v =
    Parser <| \raw -> Ok ( v, raw )


empty : String -> Parser raw a
empty msg =
    Parser <| \_ -> Err msg


get : Parser raw raw
get =
    Parser <| \raw -> Ok ( raw, raw )


run : Parser raw a -> raw -> Result String ( a, raw )
run (Parser parse) raw =
    parse raw
